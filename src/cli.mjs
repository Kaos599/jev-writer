#!/usr/bin/env node
/**
 * jev-writer CLI.
 *
 * Commands:
 *   doctor            check environment, keys, inputs, and reachability
 *   build <dir>       parse exports into a corpus
 *   rate              send the corpus through the rubric pack
 *   analyze           correlate ratings against outcomes, honestly
 *   run <dir>         all of the above
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync, appendFileSync } from 'node:fs';
import { join } from 'node:path';
import { availableProviders, detectProvider, evaluate } from './providers/index.mjs';
import { buildCorpus } from './adapters/linkedin.mjs';
import { linkedinPostPack } from './rubrics/linkedin-post.mjs';
import { validatePack, toApiQuestions, buildState, countByTier, tiersOf } from './rubrics/pack.mjs';
import { powerReport, testDimension, benjaminiHochberg } from './stats.mjs';
import { buildReport } from './report.mjs';
import { directions as linkedinDirections } from './rubrics/linkedin-post.mjs';

const OUT_DIR = process.env.JEV_WRITER_OUT ?? 'jev-out';
const PACKS = { 'linkedin-post': linkedinPostPack };
// Direction of merit per dimension, required by the report layer.
const DIRECTIONS = { 'linkedin-post': linkedinDirections };

const c = {
  dim: (s) => `\x1b[2m${s}\x1b[0m`,
  bold: (s) => `\x1b[1m${s}\x1b[0m`,
  green: (s) => `\x1b[32m${s}\x1b[0m`,
  yellow: (s) => `\x1b[33m${s}\x1b[0m`,
  red: (s) => `\x1b[31m${s}\x1b[0m`,
};

const out = (f) => join(OUT_DIR, f);
const ensureOut = () => { if (!existsSync(OUT_DIR)) mkdirSync(OUT_DIR, { recursive: true }); };
const readJsonl = (f) => readFileSync(f, 'utf8').trim().split('\n').filter(Boolean).map((l) => JSON.parse(l));

// ---------------------------------------------------------------- doctor

async function doctor() {
  console.log(c.bold('\njev-writer doctor\n'));
  let fatal = 0;

  const [maj] = process.versions.node.split('.').map(Number);
  console.log(`${maj >= 20 ? c.green('OK  ') : c.red('FAIL')} node ${process.versions.node} ${maj >= 20 ? '' : '(needs >=20)'}`);
  if (maj < 20) fatal++;

  console.log(c.bold('\nproviders'));
  const provs = availableProviders();
  for (const p of provs) {
    console.log(`  ${p.present ? c.green('set  ') : c.dim('unset')} ${p.envVar.padEnd(22)} ${p.label}`);
  }
  const anyKey = provs.some((p) => p.present);
  if (!anyKey) {
    console.log(c.red('\nFAIL no API key set. Set exactly one:'));
    for (const p of provs) console.log(`       ${p.envVar}  ->  ${p.docs}`);
    fatal++;
  } else {
    const chosen = detectProvider();
    console.log(`  ${c.green('->')} using ${c.bold(chosen.label)} (${chosen.model})`);
    if (provs.filter((p) => p.present).length > 1) {
      console.log(c.yellow('  note: several keys are set; the first in preference order wins.'));
    }
  }

  console.log(c.bold('\nAI SDK'));
  try {
    const ai = await import('ai');
    const has = Boolean(ai.experimental_evaluate);
    console.log(`  ${has ? c.green('OK  ') : c.red('FAIL')} ai package ${has ? 'exposes experimental_evaluate' : 'is too old (need >=7.0.105)'}`);
    if (!has && anyKey && detectProvider().id === 'gateway') fatal++;
  } catch {
    const needed = anyKey && detectProvider().id === 'gateway';
    console.log(`  ${needed ? c.red('FAIL') : c.dim('skip')} ai package not installed ${needed ? '(required for the AI Gateway provider)' : '(only needed for AI Gateway)'}`);
    if (needed) fatal++;
  }

  console.log(c.bold('\nrubric packs'));
  for (const [id, pack] of Object.entries(PACKS)) {
    const problems = validatePack(pack);
    const { primary, exploratory } = countByTier(pack);
    console.log(`  ${problems.length ? c.red('FAIL') : c.green('OK  ')} ${id} v${pack.version}  ${Object.keys(pack.questions).length} questions (${primary} primary / ${exploratory} exploratory)`);
    for (const p of problems) console.log(c.red(`       ${p}`));
    if (problems.length) fatal++;
  }

  if (anyKey) {
    console.log(c.bold('\nlive call'));
    try {
      const provider = detectProvider();
      const t0 = Date.now();
      const r = await evaluate(provider, {
        state: { post_body: 'We cut p99 latency from 4.2s to 380ms by moving the embedding step out of the request path.' },
        questions: { has_number: { type: 'boolean', instructions: 'Does `post_body` contain a specific measurement?' } },
      });
      const v = r.answers.has_number?.value;
      console.log(`  ${c.green('OK  ')} ${provider.label} answered in ${Date.now() - t0}ms (p=${Number(v).toFixed(2)})`);
      if (!(v > 0.5)) console.log(c.yellow('  note: the model got an easy question wrong; check the provider and model id.'));
    } catch (e) {
      console.log(`  ${c.red('FAIL')} ${String(e).slice(0, 200)}`);
      fatal++;
    }
  }

  console.log(fatal ? c.red(`\n${fatal} problem(s) to fix.\n`) : c.green('\nAll checks passed.\n'));
  process.exit(fatal ? 1 : 0);
}

// ---------------------------------------------------------------- build

function build(dir) {
  if (!dir) throw new Error('usage: jev-writer build <dir-with-linkedin-exports>');
  ensureOut();
  const { items, warnings, sources } = buildCorpus(dir);
  writeFileSync(out('corpus.jsonl'), items.map((i) => JSON.stringify(i)).join('\n') + '\n');
  console.log(c.bold(`\nbuilt ${items.length} posts -> ${out('corpus.jsonl')}`));
  for (const [k, v] of Object.entries(sources)) if (v) console.log(c.dim(`  ${k}: ${v}`));
  const withMetrics = items.filter((i) => i.has_metrics).length;
  console.log(`  with outcome data: ${withMetrics}`);
  for (const w of warnings) console.log(c.yellow(`  ! ${w}`));
  return items;
}

// ---------------------------------------------------------------- rate

async function rate({ packId = 'linkedin-post', reps = 5, concurrency = 8 } = {}) {
  const pack = PACKS[packId];
  const problems = validatePack(pack);
  if (problems.length) throw new Error(`pack "${packId}" is invalid:\n  ${problems.join('\n  ')}`);

  const items = readJsonl(out('corpus.jsonl'));
  const file = out('ratings.jsonl');
  const done = new Set(existsSync(file) ? readJsonl(file).map((r) => r.id) : []);
  const todo = items.filter((i) => !done.has(i.id));
  console.log(c.bold(`\nrating ${todo.length} posts (${done.size} already done), ${reps} reps each`));
  if (!todo.length) return;

  const provider = detectProvider();
  const questions = toApiQuestions(pack);
  const mean = (xs) => xs.reduce((a, b) => a + b, 0) / xs.length;

  let n = 0, tokens = 0;
  const t0 = Date.now();
  const queue = [...todo];

  async function once(item, attempt = 0) {
    try {
      return await evaluate(provider, { state: buildState(pack, item), questions });
    } catch (e) {
      // A near-tie in a Choice distribution can land on an exact tie, which the
      // AI SDK rejects. That is sampling noise on a genuinely ambiguous item,
      // not a reason to lose the item.
      if (attempt < 4 && /highest-probability option/.test(String(e))) return once(item, attempt + 1);
      throw e;
    }
  }

  async function worker() {
    while (queue.length) {
      const item = queue.shift();
      try {
        const runs = [];
        for (let i = 0; i < reps; i++) runs.push(await once(item));
        tokens += runs.reduce((a, r) => a + (r.usage?.inputTokens ?? 0), 0);
        const ratings = {};
        for (const [id, q] of Object.entries(questions)) {
          const vals = runs.map((r) => r.answers[id]);
          if (q.type === 'choice') {
            const tally = {};
            for (const v of vals) tally[v.value] = (tally[v.value] ?? 0) + 1;
            const [winner, k] = Object.entries(tally).sort((a, b) => b[1] - a[1])[0];
            ratings[id] = { type: q.type, value: winner, agreement: k / vals.length, confidence: mean(vals.map((v) => v.confidence ?? 0)) };
          } else {
            const xs = vals.map((v) => v.value);
            const m = mean(xs);
            ratings[id] = {
              type: q.type, value: m,
              sd: Math.sqrt(mean(xs.map((x) => (x - m) ** 2))),
              confidence: q.type === 'score' ? mean(vals.map((v) => v.confidence ?? 0)) : null,
            };
          }
        }
        appendFileSync(file, JSON.stringify({ id: item.id, date: item.date, reps, ratings }) + '\n');
      } catch (e) {
        console.error(c.red(`  ${item.id} failed: ${String(e).slice(0, 140)}`));
      }
      if (++n % 20 === 0 || n === todo.length) {
        console.log(c.dim(`  ${n}/${todo.length}  ${((Date.now() - t0) / 1000).toFixed(0)}s`));
      }
    }
  }
  await Promise.all(Array.from({ length: concurrency }, worker));
  console.log(`  ${c.green('done')}  ${tokens.toLocaleString()} input tokens`);
}

// ---------------------------------------------------------------- analyze

function analyze({ packId = 'linkedin-post' } = {}) {
  const pack = PACKS[packId];
  const tiers = tiersOf(pack);
  const items = new Map(readJsonl(out('corpus.jsonl')).map((i) => [i.id, i]));
  const ratings = readJsonl(out('ratings.jsonl'));

  const dims = {};
  for (const r of ratings) {
    for (const [q, v] of Object.entries(r.ratings)) {
      if (v.type === 'score' || v.type === 'boolean') (dims[q] ??= {})[r.id] = v.value;
    }
  }
  for (const f of ['char_count', 'word_count', 'emoji_count', 'hashtag_count', 'list_marker_count', 'avg_sentence_words', 'days_since_previous_post']) {
    const d = {};
    for (const [id, it] of items) if (it[f] != null) d[id] = it[f];
    if (Object.keys(d).length > 10) dims[`[code] ${f}`] = d;
  }

  const outcomes = ['conversion_rate', 'reach_rate'];
  const nTests = Object.keys(dims).length * outcomes.length;

  for (const outcome of outcomes) {
    const subset = [...items.values()].filter((i) => i[outcome] != null && ratings.some((r) => r.id === i.id));
    const power = powerReport(subset.length, nTests);

    console.log(c.bold(`\n${'='.repeat(74)}\n${outcome}\n${'='.repeat(74)}`));
    console.log((power.verdict === 'descriptive' ? c.red : power.verdict === 'weak' ? c.yellow : c.green)(power.headline));

    if (power.verdict === 'descriptive') {
      console.log(c.dim('\n  Correlations withheld. Collect more posts with outcome data, then re-run.'));
      continue;
    }

    const control = subset.map((i) => new Date(i.date).getTime());
    const rows = [];
    for (const [name, byId] of Object.entries(dims)) {
      const pairs = subset.map((i) => [byId[i.id], i[outcome]]).filter(([a]) => a != null);
      if (pairs.length < 15) continue;
      const vals = pairs.map(([a]) => a);
      if (new Set(vals).size < 3) continue;
      const row = testDimension({
        name, tier: tiers[name] ?? 'code',
        values: vals, outcome: pairs.map(([, b]) => b),
        control: control.slice(0, pairs.length),
      });
      if (row) rows.push(row);
    }
    // False-discovery correction runs on the DATE-CONTROLLED p, not the raw
    // one. Correcting the uncontrolled p and then calling the result
    // "confirmed" would let a finding the tool has itself flagged as shared
    // time drift survive to the headline.
    const q = benjaminiHochberg(rows.map((r) => (r.partialP ?? r.p)));
    rows.forEach((r, i) => { r.q = q[i]; });
    rows.sort((a, b) => Math.abs(b.rho) - Math.abs(a.rho));

    console.log(c.bold(`\n  ${'dimension'.padEnd(30)}${'rho'.padStart(7)}${'95% CI'.padStart(18)}${'p'.padStart(9)}${'q(BH)'.padStart(8)}  tier`));
    for (const r of rows) {
      // Three conditions, all required: pre-registered, surviving
      // false-discovery correction, and still significant once publication
      // date is controlled for.
      const sig = r.q < 0.05 && r.tier === 'primary' && r.survivesControl !== false;
      const line = `  ${r.name.padEnd(30)}${r.rho >= 0 ? '+' : ''}${r.rho.toFixed(3).padStart(6)} [${r.ci[0].toFixed(2)},${r.ci[1].toFixed(2)}]`.padEnd(58) +
        `${r.p.toFixed(4).padStart(9)}${r.q.toFixed(4).padStart(8)}  ${r.tier}` +
        (r.survivesControl === false && r.p < 0.05 ? c.yellow('  (explained by date)') : '');
      console.log(sig ? c.bold(line) : r.tier === 'exploratory' ? c.dim(line) : line);
    }
    console.log(c.dim(`\n  Bold = pre-registered, surviving false-discovery correction, and still significant`));
    console.log(c.dim(`  once publication date is controlled for. Dim = exploratory: a hypothesis, not a finding.`));
  }

  writeReport(packId);
}

/**
 * Write report.json: the plain-language artifact everything downstream is built
 * from. The terminal table above is for the operator; this file is for the
 * user, a dashboard, or an agent, and contains no statistics vocabulary.
 */
function writeReport(packId) {
  const pack = PACKS[packId];
  const dirs = DIRECTIONS[packId];
  if (!dirs) {
    console.log(c.yellow(`\n  No direction metadata for pack "${packId}"; skipping report.json.`));
    return;
  }
  const items = readJsonl(out('corpus.jsonl')).sort((a, b) => a.date.localeCompare(b.date));
  const ratings = readJsonl(out('ratings.jsonl'));
  try {
    const report = buildReport({ items, ratings, pack, directions: dirs });
    writeFileSync(out('report.json'), JSON.stringify(report, null, 2));
    const confirmed = report.findings.filter((f) => f.confirmed).length;
    console.log(c.bold(`\n  wrote ${out('report.json')}`));
    console.log(`    ${report.findings.length} findings (${confirmed} confirmed), ${report.weakSpots.length} weak spots`);
    console.log(`    ${report.posts.filter((p) => p.grade).length} posts graded`);
    console.log(report.writingPrompt
      ? c.green('    writing prompt generated from your own results')
      : c.yellow('    no writing prompt: nothing validated against your outcomes'));
  } catch (e) {
    console.error(c.red(`\n  could not write report.json: ${e.message}`));
  }
}

// ---------------------------------------------------------------- main

const [cmd, arg] = process.argv.slice(2);
try {
  if (cmd === 'doctor') await doctor();
  else if (cmd === 'build') build(arg);
  else if (cmd === 'rate') await rate();
  else if (cmd === 'analyze') analyze();
  else if (cmd === 'run') { build(arg); await rate(); analyze(); }
  else {
    console.log(`jev-writer

  doctor            check node, keys, packs, and make one live call
  build <dir>       parse platform exports in <dir> into a corpus
  rate              rate the corpus with the rubric pack
  analyze           correlate ratings against outcomes, with a power gate
  run <dir>         build, rate, analyze

Set exactly one of AI_GATEWAY_API_KEY, OPENROUTER_API_KEY, TYPESAFE_API_KEY.
Output goes to ${OUT_DIR}/ (override with JEV_WRITER_OUT).`);
  }
} catch (e) {
  console.error(c.red(`\n${e.message}\n`));
  process.exit(1);
}
