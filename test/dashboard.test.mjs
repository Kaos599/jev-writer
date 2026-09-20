import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildDashboard } from '../src/dashboard.mjs';
import { buildReport, HIGHER_IS_BETTER, LOWER_IS_BETTER } from '../src/report.mjs';
import { score, bool } from '../src/rubrics/pack.mjs';

function corpus(n, { volume = 'flat' } = {}) {
  const pack = {
    id: 'test', version: '1.0.0', stateFields: ['text'],
    groups: [{ key: 'craft', title: 'Craft', dims: ['hook_strength'] }],
    questions: {
      hook_strength: score('primary', { question: 'How strong is the hook in `text`?' },
        [{ summary: 'weak', signals: ['nothing'] }, { summary: 'strong', signals: ['something'] }]),
      is_slop: bool('exploratory', 'Does `text` read as slop?'),
    },
  };
  const directions = { hook_strength: HIGHER_IS_BETTER, is_slop: LOWER_IS_BETTER };
  const items = [], ratings = [];
  for (let i = 0; i < n; i++) {
    // `volume` controls which year each post lands in, so the derived narrative
    // can be exercised in both directions. The splits are deliberately uneven:
    // three equal years classify as "steady" and would test nothing.
    const f = i / n;
    const year = volume === 'growth' ? (f < 0.1 ? 2023 : f < 0.3 ? 2024 : 2025)
      : volume === 'collapse' ? (f < 0.8 ? 2023 : f < 0.9 ? 2024 : 2025)
      : 2025;
    items.push({
      id: `p${i}`, date: `${year}-0${(i % 9) + 1}-1${i % 9}`,
      text: `post number ${i} <script>alert(1)</script>`,
      has_metrics: true, impressions: 1000, engagements: 10 + i, followers_at_post: 500 + i,
      reach_rate: 2, conversion_rate: (10 + i) / 1000,
    });
    ratings.push({ id: `p${i}`, ratings: {
      hook_strength: { type: 'score', value: i % 7 },
      is_slop: { type: 'boolean', value: ((i * 5) % 13) / 13 },
    } });
  }
  return { items, ratings, pack, directions };
}

const render = (n, opts) => {
  const { items, ratings, pack, directions } = corpus(n, opts);
  return buildDashboard(buildReport({ items, ratings, pack, directions }), { ratings, pack, platform: 'TestNet' });
};

test('produces one self-contained document with no network dependencies', () => {
  const html = render(30);
  assert.match(html, /^<!doctype html>/i);
  assert.match(html, /<\/html>\s*$/i);
  // The whole point: it opens over file:// on a laptop with no network.
  assert.doesNotMatch(html, /<script[^>]+\ssrc=/i, 'an external script was linked');
  assert.doesNotMatch(html, /<link[^>]+stylesheet/i, 'an external stylesheet was linked');
  assert.doesNotMatch(html, /https?:\/\/(cdn|unpkg|fonts|ajax)\./i, 'a CDN host appears in the output');
});

test('post text is escaped, not injected', () => {
  const html = render(30);
  assert.doesNotMatch(html, /<script>alert\(1\)<\/script>/, 'post text reached the document unescaped');
});

test('refuses a report it cannot render rather than emitting a broken page', () => {
  assert.throws(() => buildDashboard(null), /buildReport/);
  assert.throws(() => buildDashboard({}), /buildReport/);
});

test('missing engagement data reads as "no data", never as zero', () => {
  // Found by adversarial review, and the worst class of bug this project can
  // ship. null * 100 is 0 in JS, so an unguarded percentage formatter turned
  // "we have no engagement data" into "your posts got 0.0% reach": a fabricated
  // finding presented with full confidence.
  const { items, ratings, pack, directions } = corpus(30);
  const blind = items.map((i) => ({ ...i, has_metrics: false, impressions: null, engagements: null, reach_rate: null, conversion_rate: null }));
  const report = buildReport({ items: blind, ratings, pack, directions });
  assert.equal(report.corpus.medianReachRate, null);
  const html = buildDashboard(report, { ratings, pack, platform: 'TestNet' });
  assert.match(html, /No data/);
  assert.doesNotMatch(html, /0\.0<span class="unit">%/, 'a null rate was rendered as 0.0%');
});

test('a report predating the dashboard fails with an actionable message', () => {
  const { items, ratings, pack, directions } = corpus(30);
  const report = buildReport({ items, ratings, pack, directions });
  delete report.corpus;
  assert.throws(() => buildDashboard(report, { ratings, pack }), /analyze/);
});

test('no statistics vocabulary escapes the collapsed methods section', () => {
  const html = render(30);
  // Anchor on the structural marker, and fail loudly if it moves. The first
  // version of this test searched for markup that does not exist; it passed
  // only via a fallback alternative, and any wording change to that heading
  // would have made .search() return -1, slicing the WHOLE document as "body"
  // and turning the assertion vacuously true.
  const cut = html.indexOf('<section id="methods"');
  assert.ok(cut > -1, 'the methods section anchor moved; this test is no longer checking anything');
  const body = html.slice(0, cut);
  for (const term of ['Spearman', 'rho', 'p-value', 'quintile', 'Benjamini', 'partial correlation']) {
    assert.ok(!new RegExp(term, 'i').test(body), `"${term}" leaked onto the main surface`);
  }
});

test('the volume narrative is derived from the data, never asserted', () => {
  // The hard-coded heading "You stopped posting" was true of exactly one corpus.
  const grew = render(30, { volume: 'growth' });
  assert.doesNotMatch(grew, /stopped posting|fell away|publishing less/i,
    'a growing author was told their posting fell away');
  assert.match(grew, /publishing more than you used to/i);

  const fell = render(30, { volume: 'collapse' });
  assert.match(fell, /fell away|publishing less/i);
});

test('question counts in the methods section come from the pack', () => {
  const html = render(30);
  // The pack here has 2 questions, 1 primary and 1 exploratory. The private
  // original hard-coded "30 questions ... Sixteen ... fourteen".
  assert.match(html, /2 questions in all/);
  assert.doesNotMatch(html, /30 questions|Sixteen questions/);
});

test('the platform name is parameterised, not hardcoded to LinkedIn', () => {
  const html = render(30);
  assert.doesNotMatch(html, /LinkedIn/, 'LinkedIn is hardcoded in the dashboard copy');
  assert.match(html, /TestNet/);
});

test('renders under the power gate, saying nothing held up', () => {
  const html = render(12);
  assert.match(html, /^<!doctype html>/i);
  assert.match(html, /Nothing held up firmly enough/i);
});
