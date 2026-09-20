/**
 * The interpretation layer.
 *
 * Everything upstream of this file speaks statistics. Everything downstream
 * speaks English. `buildReport()` is the boundary: it takes the corpus, the
 * ratings and the rubric pack, and emits a report model containing no rho, no
 * p-value and no confidence interval - only grades, bands, comparisons and
 * recommendations that a person who does not do statistics can act on.
 *
 * Three translations do the work.
 *
 * 1. BANDS. A raw rubric level of 1.10 means nothing to anyone. "Bottom 20% of
 *    your posts" does. Every dimension is banded against the author's own
 *    distribution, because the question that matters is not "is this good in
 *    the abstract" but "is this good for you".
 *
 * 2. DIRECTION. High human-authorship is good; high AI-feel is bad. Without
 *    per-question direction a colour scale paints the worst posts green, so
 *    direction is required metadata and `gradePost` refuses to score a pack
 *    that omits it.
 *
 * 3. TERCILE COMPARISONS instead of correlations. "rho +0.303" and "your top
 *    third averaged 34% reach against 12% for your bottom third" are the same
 *    finding. The second is actionable and needs no vocabulary. The underlying
 *    significance test still runs - it decides WHETHER a comparison is shown -
 *    it just never reaches the page.
 */

import { spearman, partialSpearman, permutationP, powerReport, rank, residualise } from './stats.mjs';

/** Direction of merit. Packs must declare one per question. */
export const HIGHER_IS_BETTER = 'higher_is_better';
export const LOWER_IS_BETTER = 'lower_is_better';
export const NEUTRAL = 'neutral';

/** Five bands, from worst to best, with labels a person can read. */
export const BANDS = [
  { key: 'poor', label: 'Poor', rank: 0, hint: 'Bottom 20% of your posts' },
  { key: 'weak', label: 'Weak', rank: 1, hint: 'Below your usual' },
  { key: 'typical', label: 'Typical', rank: 2, hint: 'About your average' },
  { key: 'strong', label: 'Strong', rank: 3, hint: 'Better than most of your posts' },
  { key: 'excellent', label: 'Excellent', rank: 4, hint: 'Top 20% of your posts' },
];

const quantile = (sorted, q) => {
  if (!sorted.length) return null;
  const i = (sorted.length - 1) * q;
  const lo = Math.floor(i), hi = Math.ceil(i);
  return lo === hi ? sorted[lo] : sorted[lo] + (sorted[hi] - sorted[lo]) * (i - lo);
};

const median = (xs) => quantile([...xs].sort((a, b) => a - b), 0.5);

/**
 * Cut points for one dimension, from the author's own distribution.
 * Quintiles rather than fixed thresholds: a rubric level is not a grade, and
 * what counts as a strong hook depends on the rest of this person's writing.
 */
export function bandEdges(values) {
  const sorted = [...values].sort((a, b) => a - b);
  return [0.2, 0.4, 0.6, 0.8].map((q) => quantile(sorted, q));
}

export function bandFor(value, edges, direction) {
  let i = 0;
  while (i < edges.length && value > edges[i]) i++;
  // i is now the quintile index 0..4 in ASCENDING value order.
  const idx = direction === LOWER_IS_BETTER ? 4 - i : i;
  return BANDS[direction === NEUTRAL ? 2 : idx];
}

/**
 * Compare the top third against the bottom third of posts on one dimension.
 * This is the replacement for reporting a correlation coefficient.
 */
export function tercileComparison(items, valueOf, outcome) {
  const withBoth = items.filter((i) => valueOf(i) != null && i[outcome] != null);
  if (withBoth.length < 12) return null;
  const sorted = [...withBoth].sort((a, b) => valueOf(a) - valueOf(b));
  const k = Math.max(3, Math.floor(sorted.length / 3));
  const bottom = sorted.slice(0, k);
  const top = sorted.slice(-k);
  const mLow = median(bottom.map((i) => i[outcome]));
  const mHigh = median(top.map((i) => i[outcome]));
  if (!mLow || !mHigh) return null;
  return {
    n: withBoth.length,
    groupSize: k,
    lowMedian: mLow,
    highMedian: mHigh,
    ratio: mHigh / mLow,
    betterAtTop: mHigh > mLow,
  };
}

const pct = (x) => `${(x * 100).toFixed(1)}%`;

/**
 * Human-readable labels. Replacing underscores with spaces yields phrases like
 * "the MOST is slop", which is exactly the machine-generated register this
 * layer exists to eliminate. Each dimension gets a noun phrase that survives
 * being dropped into an English sentence.
 */
export const DIMENSION_LABELS = {
  preview_earns_expansion: 'pull in the first two lines, before "see more"',
  hook_strength: 'stopping power in the opening line',
  payoff_delivery: 'follow-through on what the opening promised',
  reading_ease: 'easy, smooth prose',
  skimmability: 'scannable structure',
  technicality: 'technical depth',
  specificity: 'concrete detail',
  voice_confidence: 'confidence in the voice',
  cliche_density: 'stock LinkedIn phrasing',
  ai_generated_feel: 'AI-written feel',
  actionability: 'something the reader can act on',
  novelty: 'genuinely new thinking',
  shelf_life: 'lasting relevance',
  has_firsthand_evidence: 'first-hand evidence',
  teaches_transferable_skill: 'transferable lessons',
  provokes_disagreement: 'room to disagree',
  vulnerability: 'admitted failure or uncertainty',
  is_self_promotional: 'self-promotion',
  is_engagement_bait: 'engagement bait',
  is_humblebrag: 'humblebragging',
  is_slop: 'low-effort filler',
  provides_real_value: 'real takeaway value',
  human_authorship_evidence: 'evidence a real person wrote it',
  algorithmic_penalty_risk: 'things LinkedIn tends to down-rank',
};

export const labelFor = (dim) => DIMENSION_LABELS[dim] ?? dim.replace(/_/g, ' ');

/** Turn a comparison into a sentence with no statistics vocabulary in it. */
export function comparisonSentence({ dimension, outcomeShort, cmp }) {
  const label = labelFor(dimension);
  const factor = cmp.ratio >= 1 ? cmp.ratio : 1 / cmp.ratio;
  const size = factor >= 2 ? 'roughly double' : factor >= 1.5 ? 'about half again' : 'a modest amount';
  // Always phrase it as the winning side, so the sentence reads as advice.
  if (cmp.betterAtTop) {
    return `Your posts with the most ${label} got ${pct(cmp.highMedian)} ${outcomeShort}. ` +
      `The ones with the least got ${pct(cmp.lowMedian)} - ${size} less.`;
  }
  return `Your posts with the least ${label} got ${pct(cmp.lowMedian)} ${outcomeShort}. ` +
    `The ones with the most got ${pct(cmp.highMedian)} - ${size} less.`;
}

/**
 * Grade one post 0-100.
 *
 * Built only from dimensions that were VALIDATED against this author's own
 * outcomes, never from all of them. A composite over 30 rubrics would be a
 * vibe; a composite over the four that actually moved the numbers is a
 * prediction. If nothing validated, there is no grade, and the report says so
 * instead of inventing one.
 */
export function gradePost(item, ratings, validated, edgesByDim, directions) {
  if (!validated.length) return null;
  let total = 0, weightSum = 0;
  const parts = [];
  for (const { dimension, weight } of validated) {
    const v = ratings[dimension]?.value;
    if (v == null) continue;
    const dir = directions[dimension];
    if (!dir) throw new Error(`pack does not declare a direction for "${dimension}"`);
    const edges = edgesByDim[dimension];
    const band = bandFor(v, edges, dir);
    const normalised = band.rank / 4; // 0..1, already direction-aware
    total += normalised * weight;
    weightSum += weight;
    parts.push({ dimension, band: band.key, label: band.label });
  }
  if (!weightSum) return null;
  return { score: Math.round((total / weightSum) * 100), parts };
}

const OUTCOMES = {
  conversion_rate: {
    label: 'engagement from the people who saw it',
    short: 'engagement rate',
    explainer:
      'Of the people who saw this post, how many reacted or commented. This is the fairest measure of the writing itself, because it does not depend on how many followers you had or how the feed happened to treat you.',
  },
  reach_rate: {
    label: 'reach',
    short: 'reach',
    explainer:
      'How many people saw this post, compared with your follower count at the time. This is mostly about how far the platform pushed it.',
  },
};

/**
 * Build the whole report model.
 * Returns plain data. Nothing here renders, so any front end - the bundled
 * one, a Next.js app, a terminal table - consumes the same structure.
 */
export function buildReport({ items, ratings, pack, directions }) {
  const byId = new Map(ratings.map((r) => [r.id, r.ratings]));
  const rated = items.filter((i) => byId.has(i.id));
  const dims = Object.keys(pack.questions).filter(
    (q) => pack.questions[q].type !== 'choice' && rated.some((i) => byId.get(i.id)?.[q]?.value != null),
  );

  const missingDirections = dims.filter((d) => !directions[d]);
  if (missingDirections.length) {
    throw new Error(`pack is missing direction metadata for: ${missingDirections.join(', ')}`);
  }

  // Band edges from this author's own distribution.
  const edgesByDim = {};
  for (const d of dims) {
    edgesByDim[d] = bandEdges(rated.map((i) => byId.get(i.id)?.[d]?.value).filter((v) => v != null));
  }

  // Which dimensions actually predicted something, per outcome.
  const validatedByOutcome = {};
  const findings = [];
  const nTests = dims.length * Object.keys(OUTCOMES).length;

  for (const [outcome, meta] of Object.entries(OUTCOMES)) {
    const subset = rated.filter((i) => i[outcome] != null);
    const power = powerReport(subset.length, nTests);
    validatedByOutcome[outcome] = [];
    if (power.verdict === 'descriptive') continue;

    const control = subset.map((i) => new Date(i.date).getTime());
    for (const d of dims) {
      const pairs = subset.map((i) => [byId.get(i.id)?.[d]?.value, i[outcome]]).filter(([a]) => a != null);
      if (pairs.length < 15) continue;
      const a = pairs.map(([x]) => x), b = pairs.map(([, y]) => y);
      if (new Set(a).size < 3) continue;
      const partial = partialSpearman(a, b, control.slice(0, pairs.length));
      const resA = residualise(rank(a), rank(control.slice(0, pairs.length)));
      const resB = residualise(rank(b), rank(control.slice(0, pairs.length)));
      const p = permutationP(resA, resB);
      const tier = pack.questions[d].tier;
      if (!(p < 0.05) || Number.isNaN(partial)) continue;

      const cmp = tercileComparison(subset, (i) => byId.get(i.id)?.[d]?.value, outcome);
      if (!cmp) continue;
      const label = labelFor(d);
      findings.push({
        dimension: d,
        dimensionLabel: label,
        outcome,
        outcomeLabel: meta.label,
        outcomeShort: meta.short,
        outcomeExplainer: meta.explainer,
        direction: directions[d],
        tier,
        confirmed: tier === 'primary',
        comparison: cmp,
        sentence: comparisonSentence({ dimension: d, outcomeShort: meta.short, cmp }),
        // kept for the methods appendix only; never shown on the main surface
        _stats: { partialRho: partial, p, n: pairs.length },
      });
      validatedByOutcome[outcome].push({ dimension: d, weight: Math.abs(partial) });
    }
  }

  // One weight per dimension across outcomes, for the post grade.
  const weightMap = new Map();
  for (const list of Object.values(validatedByOutcome)) {
    for (const { dimension, weight } of list) {
      weightMap.set(dimension, Math.max(weightMap.get(dimension) ?? 0, weight));
    }
  }
  const validated = [...weightMap].map(([dimension, weight]) => ({ dimension, weight }));

  // Per-post grades and per-dimension bands.
  const posts = rated.map((i) => {
    const r = byId.get(i.id);
    const bands = {};
    for (const d of dims) {
      const v = r?.[d]?.value;
      if (v == null) continue;
      const band = bandFor(v, edgesByDim[d], directions[d]);
      bands[d] = { value: v, band: band.key, label: band.label, hint: band.hint, direction: directions[d] };
    }
    const grade = gradePost(i, r ?? {}, validated, edgesByDim, directions);
    // The weakest validated dimensions are what this post should fix.
    const fixes = validated
      .map(({ dimension }) => ({ dimension, band: bands[dimension] }))
      .filter((x) => x.band && x.band.band !== 'excellent' && x.band.band !== 'strong')
      .sort((a, b) => BANDS.findIndex((z) => z.key === a.band.band) - BANDS.findIndex((z) => z.key === b.band.band))
      .slice(0, 3)
      .map((x) => x.dimension);
    return { ...i, grade, bands, fixes };
  });

  // Where is this author habitually weak on things that matter?
  //
  // An earlier version counted how many posts fell in the bottom two bands.
  // That is meaningless: bands are quintiles of this author's own
  // distribution, so the bottom two are 40% of posts BY CONSTRUCTION, and
  // every dimension scored exactly 40%. The banding was fine; using it as a
  // measure of weakness was circular.
  //
  // The honest question is a gap, not a count: on each dimension that
  // predicted an outcome, how far is a typical post from the author's OWN
  // best-performing posts? That says "your winners do more of this than you
  // usually do", which is something a person can act on.
  const bestPosts = (() => {
    const withOutcome = rated.filter((i) => i.conversion_rate != null);
    if (withOutcome.length < 9) return [];
    const sorted = [...withOutcome].sort((a, b) => a.conversion_rate - b.conversion_rate);
    return sorted.slice(-Math.max(3, Math.floor(sorted.length / 3)));
  })();

  const weakSpots = bestPosts.length
    ? validated
        .map(({ dimension }) => {
          const all = rated.map((i) => byId.get(i.id)?.[dimension]?.value).filter((v) => v != null);
          const best = bestPosts.map((i) => byId.get(i.id)?.[dimension]?.value).filter((v) => v != null);
          if (!all.length || !best.length) return null;
          const typical = median(all);
          const winners = median(best);
          const dir = directions[dimension];
          // Positive gap = your best posts do MORE of the good thing than usual.
          const raw = winners - typical;
          const gap = dir === LOWER_IS_BETTER ? -raw : raw;
          const span = Math.max(...all) - Math.min(...all) || 1;
          return {
            dimension,
            label: labelFor(dimension),
            direction: dir,
            typical,
            winners,
            gap,
            gapShare: gap / span,
            advice:
              gap <= 0
                ? null
                : dir === LOWER_IS_BETTER
                  ? `Your best posts have noticeably less ${labelFor(dimension)} than your typical post.`
                  : `Your best posts have noticeably more ${labelFor(dimension)} than your typical post.`,
          };
        })
        .filter((w) => w && w.gap > 0)
        .sort((a, b) => b.gapShare - a.gapShare)
    : [];

  return {
    generatedAt: new Date().toISOString(),
    pack: { id: pack.id, version: pack.version },
    summary: {
      posts: items.length,
      rated: rated.length,
      withOutcomes: rated.filter((i) => i.has_metrics).length,
      dateRange: [items[0]?.date ?? null, items[items.length - 1]?.date ?? null],
    },
    power: Object.fromEntries(
      Object.keys(OUTCOMES).map((o) => [o, powerReport(rated.filter((i) => i[o] != null).length, nTests)]),
    ),
    outcomes: OUTCOMES,
    findings: findings.sort((a, b) => Number(b.confirmed) - Number(a.confirmed) || b.comparison.ratio - a.comparison.ratio),
    validated,
    weakSpots,
    bandEdges: edgesByDim,
    posts,
    writingPrompt: buildWritingPrompt({ findings, weakSpots, pack }),
  };
}

/**
 * A prompt the author can paste into any assistant before publishing the next
 * draft. It is generated from THEIR results: the dimensions that predicted
 * engagement for them, and the ones they are habitually weak on. Generic
 * "write a better hook" advice is exactly what this replaces.
 */
export function buildWritingPrompt({ findings, weakSpots, pack }) {
  if (!findings.length) {
    return null;
  }
  const lines = [];
  lines.push('You are reviewing a draft post before I publish it.');
  lines.push('');
  lines.push('These checks come from an analysis of my own published posts and what actually');
  lines.push('earned engagement for my audience. Apply them in order of importance.');
  lines.push('');

  const seen = new Set();
  let n = 1;
  for (const f of findings) {
    if (seen.has(f.dimension)) continue;
    seen.add(f.dimension);
    const q = pack.questions[f.dimension];
    const want = f.direction === LOWER_IS_BETTER ? 'LESS' : 'MORE';
    lines.push(`${n}. ${labelFor(f.dimension).toUpperCase()} - I need ${want} of this.`);
    const instr = typeof q.instructions === 'string' ? q.instructions : q.instructions?.question ?? '';
    if (instr) lines.push(`   What it means: ${instr}`);
    if (Array.isArray(q.criteria)) {
      const best = f.direction === LOWER_IS_BETTER ? q.criteria[0] : q.criteria[q.criteria.length - 1];
      const target = typeof best === 'string' ? best : best?.summary;
      if (target) lines.push(`   Aim for: ${target}`);
    }
    lines.push(`   Evidence: ${f.sentence}`);
    lines.push('');
    n++;
  }

  const habitual = weakSpots.slice(0, 3);
  if (habitual.length) {
    lines.push('The gap between my best posts and my typical post is largest on these,');
    lines.push('so check them hardest:');
    for (const w of habitual) lines.push(`  - ${w.advice}`);
    lines.push('');
  }

  lines.push('Respond with:');
  lines.push('  a) a verdict for each check above: does the draft pass, and why;');
  lines.push('  b) the single change that would most improve it;');
  lines.push('  c) a rewritten version of the weakest paragraph.');
  lines.push('');
  lines.push('Be blunt. Do not tell me it is good if it is not.');
  lines.push('');
  lines.push('--- DRAFT ---');
  lines.push('[paste your draft here]');
  return lines.join('\n');
}
