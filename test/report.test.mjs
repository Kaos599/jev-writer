import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  BANDS,
  bandEdges,
  bandFor,
  gradePost,
  buildReport,
  buildWritingPrompt,
  labelFor,
  corpusFacts,
  cadenceOf,
  HIGHER_IS_BETTER,
  LOWER_IS_BETTER,
  NEUTRAL,
} from '../src/report.mjs';
import { score, bool } from '../src/rubrics/pack.mjs';

/* ------------------------------------------------------------------ bands */

test('bands are quintiles of the observed distribution', () => {
  const edges = bandEdges([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
  assert.equal(edges.length, 4);
  for (let i = 1; i < edges.length; i++) assert.ok(edges[i] >= edges[i - 1]);
});

test('direction flips the band, so low is good where low is good', () => {
  const edges = bandEdges([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
  const high = bandFor(10, edges, HIGHER_IS_BETTER);
  const low = bandFor(1, edges, HIGHER_IS_BETTER);
  assert.equal(high.key, 'excellent');
  assert.equal(low.key, 'poor');

  // Same raw value, opposite direction of merit, opposite band.
  assert.equal(bandFor(10, edges, LOWER_IS_BETTER).key, 'poor');
  assert.equal(bandFor(1, edges, LOWER_IS_BETTER).key, 'excellent');
});

test('neutral dimensions are never banded as good or bad', () => {
  const edges = bandEdges([1, 2, 3, 4, 5]);
  const b = bandFor(5, edges, NEUTRAL);
  assert.ok(!['excellent', 'poor'].includes(b.key), `neutral produced "${b.key}"`);
});

test('every band key has a human label and none is a statistics term', () => {
  const jargon = /rho|correlat|p-value|quantile|quintile|percentile|spearman|sigma/i;
  for (const b of BANDS) {
    assert.ok(b.label && b.label.length, `band ${b.key} has no label`);
    assert.ok(!jargon.test(b.label), `band label "${b.label}" leaks statistics vocabulary`);
  }
});

/* --------------------------------------------------------------- labelling */

test('labelFor never returns a sentence fragment that reads as nonsense', () => {
  // The bug this pins: generated labels once produced "the MOST is slop".
  for (const d of ['is_slop', 'ai_generated_feel', 'hook_strength', 'unknown_dimension_xyz']) {
    const l = labelFor(d);
    assert.ok(l && !l.includes('_'), `labelFor(${d}) returned "${l}"`);
    assert.ok(!/\bthe (MOST|LEAST)\b/.test(l), `labelFor(${d}) returned "${l}"`);
  }
});

/* ---------------------------------------------------------------- cadence */

test('cadence is null below two years, because one year is not a trend', () => {
  assert.equal(cadenceOf([]), null);
  assert.equal(cadenceOf([{ year: '2025', posts: 9 }]), null);
});

test('cadence distinguishes a collapse from growth', () => {
  const collapsed = cadenceOf([
    { year: '2023', posts: 30 },
    { year: '2024', posts: 6 },
    { year: '2025', posts: 5 },
  ]);
  assert.equal(collapsed.direction, 'collapsed');
  assert.equal(collapsed.peakYear, '2023');

  const rising = cadenceOf([
    { year: '2023', posts: 5 },
    { year: '2024', posts: 12 },
    { year: '2025', posts: 30 },
  ]);
  assert.equal(rising.direction, 'rising');

  const steady = cadenceOf([
    { year: '2024', posts: 20 },
    { year: '2025', posts: 18 },
  ]);
  assert.equal(steady.direction, 'steady');
});

test('a year that ties the peak is never described as a decline', () => {
  // Found by adversarial review. peak was chosen with a strict `>`, so the
  // FIRST of two equal years won, the later one fell into the "other years"
  // average, and an author whose latest year matched their best year was told
  // they were publishing less. The exact false accusation cadenceOf exists to
  // prevent, reintroduced through a comparison operator.
  const tied = cadenceOf([
    { year: '2022', posts: 5 },
    { year: '2023', posts: 50 },
    { year: '2024', posts: 50 },
  ]);
  assert.notEqual(tied.direction, 'declined');
  assert.notEqual(tied.direction, 'collapsed');
});

test('corpusFacts counts posts per year and carries follower endpoints', () => {
  const items = [
    { date: '2024-01-01', has_metrics: true, followers_at_post: 100, impressions: 1000, engagements: 50, reach_rate: 10, conversion_rate: 0.05 },
    { date: '2024-06-01', has_metrics: false },
    { date: '2025-01-01', has_metrics: true, followers_at_post: 200, impressions: 2000, engagements: 40, reach_rate: 10, conversion_rate: 0.02 },
  ];
  const f = corpusFacts(items);
  assert.deepEqual(f.volumeByYear.map((r) => [r.year, r.posts, r.withMetrics]), [['2024', 2, 1], ['2025', 1, 1]]);
  assert.equal(f.followerStart, 100);
  assert.equal(f.followerEnd, 200);
  assert.equal(f.totalImpressions, 3000);
  assert.equal(f.totalEngagements, 90);
});

/* -------------------------------------------------------- the power refusal */

// The single most important behaviour in the repo: below the threshold the
// tool must produce NO findings, however tempting the data looks.
function tinyCorpus(n) {
  const pack = {
    id: 'test', version: '1.0.0', stateFields: ['text'],
    questions: {
      hook_strength: score('primary', { question: 'How strong is the hook in `text`?' },
        [{ summary: 'weak', signals: ['nothing'] }, { summary: 'strong', signals: ['something'] }]),
      is_slop: bool('primary', 'Does `text` read as slop?'),
    },
  };
  const directions = { hook_strength: HIGHER_IS_BETTER, is_slop: LOWER_IS_BETTER };
  const items = [];
  const ratings = [];
  for (let i = 0; i < n; i++) {
    // Deliberately perfect, noiseless correlation. Nothing should survive the gate.
    items.push({
      id: `p${i}`, date: `2025-01-${String((i % 28) + 1).padStart(2, '0')}`, text: `post ${i}`,
      has_metrics: true, impressions: 1000, engagements: 10 + i,
      followers_at_post: 500, reach_rate: 2, conversion_rate: (10 + i) / 1000,
    });
    // The two dimensions must NOT be collinear: if they are, identical gap
    // shares are the correct answer and the test below proves nothing.
    ratings.push({ id: `p${i}`, ratings: {
      hook_strength: { type: 'score', value: i },
      is_slop: { type: 'boolean', value: ((i * 7) % 11) / 11 },
    } });
  }
  return { items, ratings, pack, directions };
}

test('below the power threshold it reports nothing, even on a perfect correlation', () => {
  const r = buildReport(tinyCorpus(12));
  assert.equal(r.findings.length, 0, 'findings leaked past the power gate');
  assert.equal(r.writingPrompt, null, 'a writing prompt was generated with no validated findings');
  assert.equal(r.power.conversion_rate.verdict, 'descriptive');
});

test('a report always carries its own provenance and shape', () => {
  const r = buildReport(tinyCorpus(30));
  for (const k of ['generatedAt', 'pack', 'summary', 'power', 'outcomes', 'findings', 'validated', 'weakSpots', 'bandEdges', 'corpus', 'posts']) {
    assert.ok(k in r, `report is missing "${k}"`);
  }
  assert.equal(r.summary.posts, 30);
  assert.ok(Array.isArray(r.findings));
  assert.equal(r.pack.id, 'test');
});

/* ---------------------------------------------- weak spots are not artifacts */

test('weak spots are a gap, not a count of the bottom bands', () => {
  // Bands are quintiles, so "share of posts in the bottom two bands" is 40% BY
  // CONSTRUCTION and identical for every dimension. That bug shipped once.
  const r = buildReport(tinyCorpus(40));
  // The artifact to guard against: a "weakness" measure derived from counting
  // posts in the bottom two bands is 40% for every dimension, always, because
  // bands are quintiles. A gap-based measure must not be a constant.
  for (const w of r.weakSpots) {
    assert.notEqual(w.gapShare, 0.4, 'gapShare is the 40% quintile artifact');
    assert.ok(w.typical != null && w.winners != null, 'a gap must compare two real medians');
    assert.notEqual(w.typical, w.winners, 'a reported gap has identical endpoints');
  }
  for (const w of r.weakSpots) {
    assert.ok(w.gap > 0, 'a weak spot was reported with no gap to close');
    assert.ok(w.advice, 'a weak spot has no advice attached');
  }
});

/* -------------------------------------------------------------- the prompt */

test('the writing prompt is null when nothing was validated', () => {
  assert.equal(buildWritingPrompt({ findings: [], weakSpots: [], pack: { questions: {} } }), null);
});

test('the writing prompt states a direction for every finding it cites', () => {
  const pack = {
    questions: {
      hook_strength: { instructions: { question: 'How strong is the hook?' }, criteria: [{ summary: 'weak' }, { summary: 'strong' }] },
    },
  };
  const prompt = buildWritingPrompt({
    findings: [{ dimension: 'hook_strength', direction: HIGHER_IS_BETTER, sentence: 'Posts with stronger hooks did better.' }],
    weakSpots: [],
    pack,
  });
  assert.match(prompt, /MORE of this/);
  assert.match(prompt, /Posts with stronger hooks did better\./);
  assert.doesNotMatch(prompt, /rho|p-value|Spearman|correlation/i);
});

/* ------------------------------------------------------------------ grades */

test('a post with no validated dimensions gets no grade rather than a fake one', () => {
  const edges = { hook_strength: bandEdges([1, 2, 3, 4, 5]) };
  const g = gradePost({ id: 'x' }, {}, [], edges, { hook_strength: HIGHER_IS_BETTER });
  assert.equal(g, null);
});
