import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  rank, spearman, partialSpearman, criticalR, minimumDetectableEffect,
  powerReport, benjaminiHochberg, permutationP, testDimension, DEFAULT_SEED,
} from '../src/stats.mjs';

test('rank averages ties', () => {
  assert.deepEqual(rank([10, 20, 20, 30]), [1, 2.5, 2.5, 4]);
});

test('spearman is 1 for a monotonic non-linear relation', () => {
  const x = [1, 2, 3, 4, 5];
  const y = x.map((v) => v ** 3);
  assert.ok(Math.abs(spearman(x, y) - 1) < 1e-9);
});

test('spearman is -1 when reversed', () => {
  assert.ok(Math.abs(spearman([1, 2, 3, 4], [4, 3, 2, 1]) + 1) < 1e-9);
});

// Deterministic LCG so the noise is reproducible AND genuinely independent
// between series. An earlier version of this test reused a short noise array,
// which gave both series a shared periodic component and left a real -0.59
// residual correlation after removing t: the partial was right, the fixture
// was wrong.
function lcg(seed) {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 4294967296 - 0.5;
  };
}

test('partial correlation removes a shared time trend', () => {
  const t = Array.from({ length: 200 }, (_, i) => i + 1);
  const ra = lcg(11), rb = lcg(977);
  const a = t.map((v) => v * 2 + ra() * 120);
  const b = t.map((v) => v * 3 + rb() * 180);
  assert.ok(spearman(a, b) > 0.7, 'raw correlation should be strong and spurious');
  assert.ok(Math.abs(partialSpearman(a, b, t)) < 0.2, 'partial should collapse once t is removed');
});

test('partial correlation is undefined under perfect collinearity', () => {
  // If the covariate explains a dimension exactly, nothing is left to
  // correlate. NaN is the honest answer; silently returning 0 would imply
  // evidence of no relationship where there is simply no information.
  const t = [1, 2, 3, 4, 5, 6, 7, 8];
  assert.ok(Number.isNaN(partialSpearman(t.map((v) => v * 2), t.map((v) => v * 3), t)));
});

test('critical r matches the known value at n=43', () => {
  assert.ok(Math.abs(criticalR(43) - 0.300) < 0.005);
});

test('minimum detectable effect exceeds the significance threshold', () => {
  // You can only reliably DETECT effects larger than the ones that can merely
  // reach significance. Conflating the two is how underpowered studies happen.
  assert.ok(minimumDetectableEffect(43) > criticalR(43));
});

test('power report refuses to draw conclusions below n=25', () => {
  const r = powerReport(18, 60);
  assert.equal(r.verdict, 'descriptive');
  assert.match(r.headline, /descriptive statistics only/);
});

test('power report warns but permits between 25 and 60', () => {
  const r = powerReport(43, 60);
  assert.equal(r.verdict, 'weak');
  assert.ok(Math.abs(r.expectedFalsePositives - 3) < 1e-9);
});

test('benjamini-hochberg is monotone and never shrinks a p-value', () => {
  const p = [0.001, 0.01, 0.04, 0.2, 0.9];
  const q = benjaminiHochberg(p);
  for (let i = 0; i < p.length; i++) assert.ok(q[i] >= p[i] - 1e-12);
  for (let i = 1; i < q.length; i++) assert.ok(q[i] >= q[i - 1] - 1e-12);
});

test('permutation p is small for a strong relationship', () => {
  const a = Array.from({ length: 30 }, (_, i) => i);
  const b = a.map((v) => v * 1.5);
  assert.ok(permutationP(a, b, 2000) < 0.01);
});

test('permutation p is a valid probability and is not tiny for noise', () => {
  // Averaged over several unrelated pairs, p should not cluster near zero.
  const pairs = [
    [[3, 1, 4, 1, 5, 9, 2, 6, 5, 3], [2, 7, 1, 8, 2, 8, 1, 8, 2, 8]],
    [[1, 4, 1, 5, 9, 2, 6, 5, 3, 5], [8, 2, 8, 4, 5, 9, 0, 4, 5, 2]],
    [[2, 7, 1, 8, 2, 8, 1, 8, 2, 8], [3, 1, 4, 1, 5, 9, 2, 6, 5, 3]],
  ];
  const ps = pairs.map(([x, y]) => permutationP(x, y, 2000));
  for (const p of ps) assert.ok(p > 0 && p <= 1, `p out of range: ${p}`);
  assert.ok(ps.reduce((s, p) => s + p, 0) / ps.length > 0.15, 'noise should not look significant on average');
});

// --------------------------------------------------------------------------
// the seed
// --------------------------------------------------------------------------

// A pair with no real relationship, so the p-value is dominated by the shuffle
// stream and any change of seed shows up immediately.
const NOISE_A = [3, 1, 4, 1, 5, 9, 2, 6, 5, 3];
const NOISE_B = [2, 7, 1, 8, 2, 8, 1, 8, 2, 8];

test('the default seed is the pre-registered one and still produces the old numbers', () => {
  // Pinned literally. If the generator, the shuffle order, or the default seed
  // ever changes, every previously published p-value silently changes with it,
  // which is exactly what a pre-registered analysis cannot allow.
  assert.equal(DEFAULT_SEED, 20260920);
  assert.equal(permutationP(NOISE_A, NOISE_B, 2000), 0.7151424287856072);
});

test('an explicit default seed is identical to omitting it', () => {
  assert.equal(
    permutationP(NOISE_A, NOISE_B, 2000, { seed: DEFAULT_SEED }),
    permutationP(NOISE_A, NOISE_B, 2000),
  );
});

test('overriding the seed changes the permutation stream', () => {
  const a = permutationP(NOISE_A, NOISE_B, 2000, { seed: 7 });
  const b = permutationP(NOISE_A, NOISE_B, 2000, { seed: 42 });
  assert.notEqual(a, permutationP(NOISE_A, NOISE_B, 2000));
  assert.notEqual(a, b);
});

test('the same override is reproducible', () => {
  assert.equal(
    permutationP(NOISE_A, NOISE_B, 2000, { seed: 7 }),
    permutationP(NOISE_A, NOISE_B, 2000, { seed: 7 }),
  );
});

test('a bare number is still accepted as the seed', () => {
  // The seed was positional before it was an option, and this function is
  // exported from the package root.
  assert.equal(
    permutationP(NOISE_A, NOISE_B, 2000, 7),
    permutationP(NOISE_A, NOISE_B, 2000, { seed: 7 }),
  );
});

test('testDimension reports the seed it actually used', () => {
  const values = [5, 3, 8, 1, 9, 2, 7, 4, 6, 10, 2, 8];
  const outcome = [1, 2, 9, 1, 8, 3, 7, 4, 5, 9, 2, 6];
  const dflt = testDimension({ name: 'd', tier: 'primary', values, outcome });
  assert.equal(dflt.seed, DEFAULT_SEED);

  const other = testDimension({ name: 'd', tier: 'primary', values, outcome, seed: 1234 });
  assert.equal(other.seed, 1234);
  assert.equal(other.rho, dflt.rho, 'the point estimate does not depend on the seed');
  assert.notDeepEqual(other.ci, dflt.ci, 'the resampled interval does');
});
