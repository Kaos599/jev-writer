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

test('no statistics vocabulary escapes the collapsed methods section', () => {
  const html = render(30);
  const body = html.slice(0, html.search(/<details[^>]*id="methods"|<h4>What was measured<\/h4>/i));
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
