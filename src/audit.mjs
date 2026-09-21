/**
 * Single-post pre-flight audit against a rubric pack.
 *
 * Evaluates a single post (from a file path, string, or stdin) across a
 * rubric pack using Jev. Designed for fast pre-flight review before publishing.
 */

import { readFileSync, existsSync } from 'node:fs';
import { splitHook, TRUNCATION_CHARS } from './adapters/linkedin.mjs';
import { buildState, toApiQuestions } from './rubrics/pack.mjs';
import { detectProvider, evaluate } from './providers/index.mjs';

/**
 * Prepares post item state from raw text or a file path.
 *
 * @param {string} input - file path, markdown text, or '-' for stdin
 * @returns {{ text: string, hook_text: string, post_body: string, preview_text: string }}
 */
export function preparePostState(input) {
  let text = input;
  if (typeof input === 'string' && input !== '-' && existsSync(input)) {
    text = readFileSync(input, 'utf8');
  } else if (input === '-') {
    text = readFileSync(0, 'utf8');
  }

  if (!text || !text.trim()) {
    throw new Error('input text is empty');
  }

  const { hook_text, post_body } = splitHook(text);
  const preview_text = text.slice(0, TRUNCATION_CHARS);

  return { text, hook_text, post_body, preview_text };
}

/**
 * Evaluates a single post against a rubric pack.
 *
 * @param {string} input - file path, markdown text, or '-' for stdin
 * @param {object} opts
 * @param {object} opts.pack - rubric pack (e.g. linkedinPostPack)
 * @param {object} [opts.provider] - detected provider or override
 * @param {number} [opts.reps=1] - number of repetitions to average
 * @returns {Promise<object>} audit result object
 */
export async function auditPost(input, { pack, provider = null, reps = 1 } = {}) {
  if (!pack) throw new Error('auditPost requires a rubric pack');
  const chosenProvider = provider ?? detectProvider();
  const { text, hook_text, post_body, preview_text } = preparePostState(input);
  const item = { hook_text, post_body, preview_text };
  const state = buildState(pack, item);
  const questions = toApiQuestions(pack);

  async function once(attempt = 0) {
    try {
      return await evaluate(chosenProvider, { state, questions });
    } catch (e) {
      if (attempt < 4 && /highest-probability option/.test(String(e))) return once(attempt + 1);
      throw e;
    }
  }

  const runs = [];
  for (let i = 0; i < reps; i++) runs.push(await once());

  const ratings = {};
  const mean = (xs) => xs.reduce((a, b) => a + b, 0) / xs.length;

  for (const [id, q] of Object.entries(questions)) {
    const vals = runs.map((r) => r.answers[id]);
    if (q.type === 'choice') {
      const tally = {};
      for (const v of vals) tally[v.value] = (tally[v.value] ?? 0) + 1;
      const [winner, k] = Object.entries(tally).sort((a, b) => b[1] - a[1])[0];
      ratings[id] = {
        type: q.type,
        value: winner,
        agreement: k / vals.length,
        probabilities: vals[0]?.probabilities ?? null,
      };
    } else if (q.type === 'score') {
      const xs = vals.map((v) => v.value);
      ratings[id] = {
        type: q.type,
        value: Math.round(mean(xs) * 100) / 100,
        probabilities: vals[0]?.probabilities ?? null,
      };
    } else {
      const xs = vals.map((v) => v.value);
      ratings[id] = {
        type: q.type,
        value: Math.round(mean(xs) * 100) / 100,
      };
    }
  }

  return {
    pack: { id: pack.id, version: pack.version },
    provider: { id: chosenProvider.id, label: chosenProvider.label, model: chosenProvider.model },
    state: {
      charCount: text.length,
      wordCount: (text.match(/\b[\w'-]+\b/g) ?? []).length,
      previewText: preview_text,
      hookText: hook_text,
    },
    ratings,
    tokens: runs.reduce((acc, r) => acc + (r.usage?.inputTokens ?? 0), 0),
  };
}

/**
 * Format audit results into a readable terminal output.
 */
export function formatAuditTerminal(auditResult, pack) {
  const c = {
    dim: (s) => `\x1b[2m${s}\x1b[0m`,
    bold: (s) => `\x1b[1m${s}\x1b[0m`,
    green: (s) => `\x1b[32m${s}\x1b[0m`,
    yellow: (s) => `\x1b[33m${s}\x1b[0m`,
    cyan: (s) => `\x1b[36m${s}\x1b[0m`,
    red: (s) => `\x1b[31m${s}\x1b[0m`,
  };

  const { state, ratings, provider } = auditResult;
  const lines = [];

  lines.push(c.bold(`\njev-writer audit: ${pack.id} v${pack.version}`));
  lines.push(c.dim(`Provider: ${provider.label} (${provider.model}) · ${state.wordCount} words · ${state.charCount} chars\n`));

  lines.push(c.bold('Preview ("see more" cut):'));
  lines.push(`"${state.previewText}…"\n`);

  const groups = pack.groups ?? [{ key: 'all', title: 'All Questions', dims: Object.keys(pack.questions) }];

  for (const grp of groups) {
    lines.push(c.bold(`[ ${grp.title} ]`));
    for (const dim of grp.dims) {
      const r = ratings[dim];
      if (!r) continue;
      const q = pack.questions[dim];
      let valStr = '';

      if (r.type === 'score') {
        const val = r.value;
        const max = (q.levels?.length ?? 4) - 1;
        valStr = `${val.toFixed(2)} / ${max}`;
        if (dim === 'ai_generated_feel' || dim === 'cliche_density' || dim === 'algorithmic_penalty_risk') {
          valStr = val <= 1.0 ? c.green(valStr) : val >= 2.0 ? c.red(valStr) : c.yellow(valStr);
        } else {
          valStr = val >= 2.0 ? c.green(valStr) : val <= 1.0 ? c.yellow(valStr) : valStr;
        }
      } else if (r.type === 'choice') {
        valStr = c.cyan(String(r.value));
      } else {
        const pct = Math.round(r.value * 100);
        valStr = `${pct}%`;
        if (dim === 'is_slop' || dim === 'is_engagement_bait' || dim === 'is_humblebrag') {
          valStr = pct <= 25 ? c.green(valStr) : pct >= 60 ? c.red(valStr) : c.yellow(valStr);
        } else {
          valStr = pct >= 70 ? c.green(valStr) : pct <= 30 ? c.yellow(valStr) : valStr;
        }
      }

      lines.push(`  ${dim.padEnd(28)} ${valStr}`);
    }
    lines.push('');
  }

  // Highlights
  const needed = ratings.most_needed_improvement?.value;
  if (needed && needed !== 'nothing_significant') {
    lines.push(c.bold(c.yellow(`Primary Lever for Improvement: `)) + c.bold(needed.replace(/_/g, ' ')));
  }

  return lines.join('\n');
}

/**
 * Format audit results into a markdown document.
 */
export function formatAuditMarkdown(auditResult, pack) {
  const { state, ratings, provider } = auditResult;
  const lines = [];

  lines.push(`# Jev Pre-Flight Content Audit\n`);
  lines.push(`- **Rubric:** \`${pack.id}\` (v${pack.version})`);
  lines.push(`- **Model:** ${provider.label} (\`${provider.model}\`)`);
  lines.push(`- **Length:** ${state.wordCount} words · ${state.charCount} characters\n`);

  lines.push(`### Preview Text Cut (~${TRUNCATION_CHARS} chars before "see more")`);
  lines.push(`> ${state.previewText}…\n`);

  const groups = pack.groups ?? [{ key: 'all', title: 'All Questions', dims: Object.keys(pack.questions) }];

  for (const grp of groups) {
    lines.push(`### ${grp.title}`);
    lines.push(`| Dimension | Value | Type |`);
    lines.push(`| :--- | :--- | :--- |`);
    for (const dim of grp.dims) {
      const r = ratings[dim];
      if (!r) continue;
      const q = pack.questions[dim];
      let val = '';
      if (r.type === 'score') {
        val = `**${r.value.toFixed(2)}** / ${(q.levels?.length ?? 4) - 1}`;
      } else if (r.type === 'choice') {
        val = `\`${r.value}\``;
      } else {
        val = `**${Math.round(r.value * 100)}%**`;
      }
      lines.push(`| \`${dim}\` | ${val} | ${r.type} |`);
    }
    lines.push('');
  }

  const needed = ratings.most_needed_improvement?.value;
  if (needed) {
    lines.push(`**Most Needed Improvement:** \`${needed}\`\n`);
  }

  return lines.join('\n');
}
