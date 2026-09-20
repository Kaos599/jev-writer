/**
 * Statistics, including the part that refuses to answer.
 *
 * A pipeline that scores 30 dimensions against 2 outcomes runs 60 tests. At
 * alpha = 0.05, about 3 of them come back "significant" on pure noise. Ship
 * that without guardrails and you have built a p-hacking machine that tells
 * every user a confident story about their writing.
 *
 * So this module computes its own limits before it reports anything:
 *   - the critical correlation needed for significance at this n
 *   - the minimum effect this n can detect at 80% power
 *   - how many of the "significant" results are expected by chance
 * and `powerReport()` returns a verdict that the CLI is required to honour.
 *
 * Correlations are Spearman rank throughout. Jev's score magnitudes are
 * explicitly not numerically calibrated - the model card warns against
 * interpolating between levels - so treating them as interval quantities
 * would read precision that is not there.
 */

// --------------------------------------------------------------------------
// primitives
// --------------------------------------------------------------------------

export function rank(xs) {
  const order = [...xs.keys()].sort((a, b) => xs[a] - xs[b]);
  const r = new Array(xs.length).fill(0);
  let i = 0;
  while (i < order.length) {
    let j = i;
    while (j + 1 < order.length && xs[order[j + 1]] === xs[order[i]]) j++;
    const avg = (i + j) / 2 + 1;
    for (let k = i; k <= j; k++) r[order[k]] = avg;
    i = j + 1;
  }
  return r;
}

export function pearson(a, b) {
  const n = a.length;
  if (n < 3) return NaN;
  const ma = a.reduce((x, y) => x + y, 0) / n;
  const mb = b.reduce((x, y) => x + y, 0) / n;
  let va = 0, vb = 0, cov = 0;
  for (let i = 0; i < n; i++) {
    va += (a[i] - ma) ** 2;
    vb += (b[i] - mb) ** 2;
    cov += (a[i] - ma) * (b[i] - mb);
  }
  if (va === 0 || vb === 0) return NaN;
  return cov / Math.sqrt(va * vb);
}

export const spearman = (a, b) => pearson(rank(a), rank(b));

/** Residuals of y after least-squares removal of x. */
export function residualise(y, x) {
  const n = x.length;
  const mx = x.reduce((a, b) => a + b, 0) / n;
  const my = y.reduce((a, b) => a + b, 0) / n;
  let vx = 0, cov = 0;
  for (let i = 0; i < n; i++) {
    vx += (x[i] - mx) ** 2;
    cov += (x[i] - mx) * (y[i] - my);
  }
  if (vx === 0) return y.map((v) => v - my);
  const b = cov / vx;
  return y.map((v, i) => v - (my + b * (x[i] - mx)));
}

/**
 * Partial Spearman controlling for one covariate.
 * Publication dates are the usual culprit: if both the rated dimension and the
 * outcome drift over time, their raw correlation can be entirely shared trend.
 */
export function partialSpearman(a, b, control) {
  const ra = rank(a), rb = rank(b), rc = rank(control);
  return pearson(residualise(ra, rc), residualise(rb, rc));
}

// --------------------------------------------------------------------------
// inference
// --------------------------------------------------------------------------

function mulberry32(seed) {
  return function () {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Permutation test. Exact enough at these n, and assumes nothing about shape. */
export function permutationP(a, b, iterations = 10000, seed = 20260920) {
  const observed = Math.abs(spearman(a, b));
  if (Number.isNaN(observed)) return NaN;
  const rnd = mulberry32(seed);
  const shuffled = [...b];
  let hits = 0;
  for (let it = 0; it < iterations; it++) {
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(rnd() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    const r = spearman(a, shuffled);
    if (!Number.isNaN(r) && Math.abs(r) >= observed) hits++;
  }
  return (hits + 1) / (iterations + 1);
}

/** Bootstrap percentile CI. Normal approximations are not trustworthy at n<60. */
export function bootstrapCI(a, b, { iterations = 5000, alpha = 0.05, seed = 20260920 } = {}) {
  const rnd = mulberry32(seed);
  const n = a.length;
  const out = [];
  for (let it = 0; it < iterations; it++) {
    const ia = [], ib = [];
    for (let i = 0; i < n; i++) {
      const k = Math.floor(rnd() * n);
      ia.push(a[k]);
      ib.push(b[k]);
    }
    const r = spearman(ia, ib);
    if (!Number.isNaN(r)) out.push(r);
  }
  if (out.length < 100) return [NaN, NaN];
  out.sort((x, y) => x - y);
  return [out[Math.floor((alpha / 2) * out.length)], out[Math.ceil((1 - alpha / 2) * out.length) - 1]];
}

/** Benjamini-Hochberg. Returns the adjusted q-value for each input p. */
export function benjaminiHochberg(pValues) {
  const m = pValues.length;
  const idx = [...pValues.keys()].sort((i, j) => pValues[i] - pValues[j]);
  const q = new Array(m).fill(NaN);
  let prev = 1;
  for (let k = m - 1; k >= 0; k--) {
    const i = idx[k];
    prev = Math.min(prev, (pValues[i] * m) / (k + 1));
    q[i] = prev;
  }
  return q;
}

// --------------------------------------------------------------------------
// the refusal
// --------------------------------------------------------------------------

const Z_ALPHA_2 = 1.959964; // two-sided 0.05
const Z_BETA_80 = 0.841621; // 80% power

/** Smallest |rho| that reaches p<0.05 at this n (Fisher z). */
export function criticalR(n) {
  if (n < 5) return NaN;
  return Math.tanh(Z_ALPHA_2 / Math.sqrt(n - 3));
}

/** Smallest true |rho| this n can detect 80% of the time. */
export function minimumDetectableEffect(n) {
  if (n < 5) return NaN;
  return Math.tanh((Z_ALPHA_2 + Z_BETA_80) / Math.sqrt(n - 3));
}

/**
 * Decide what this dataset is allowed to claim.
 *
 * `verdict` is one of:
 *   'report'      - n supports correlational findings
 *   'weak'        - findings allowed, but only pre-registered ones, heavily caveated
 *   'descriptive' - too small; show descriptives and refuse correlations
 */
export function powerReport(n, nTests) {
  const crit = criticalR(n);
  const mde = minimumDetectableEffect(n);
  const expectedFalsePositives = 0.05 * nTests;

  let verdict, headline;
  if (n < 25) {
    verdict = 'descriptive';
    headline =
      `Too few posts with outcome data (n=${n}) to test anything. ` +
      `At this sample size even a true correlation of ${Number.isNaN(mde) ? '-' : mde.toFixed(2)} would be missed most of the time, ` +
      `and any "significant" result is more likely noise than signal. Showing descriptive statistics only.`;
  } else if (n < 60) {
    verdict = 'weak';
    headline =
      `n=${n}. Only correlations above |${crit.toFixed(2)}| can reach significance, and only true effects above ` +
      `|${mde.toFixed(2)}| would be detected reliably. Across ${nTests} tests, about ${expectedFalsePositives.toFixed(1)} ` +
      `will look significant by chance alone. Treat pre-registered results as evidence and everything else as a hypothesis.`;
  } else {
    verdict = 'report';
    headline =
      `n=${n}. Correlations above |${crit.toFixed(2)}| reach significance; effects above |${mde.toFixed(2)}| are detected reliably. ` +
      `About ${expectedFalsePositives.toFixed(1)} of ${nTests} tests will look significant by chance, so false-discovery correction is applied.`;
  }
  return { n, nTests, criticalR: crit, minimumDetectableEffect: mde, expectedFalsePositives, verdict, headline };
}

/**
 * Run one dimension against one outcome and return an honest row.
 * `tier` carries the pre-registration: 'primary' results are evidence,
 * 'exploratory' results are hypotheses for the next batch of data.
 */
export function testDimension({ name, tier, values, outcome, control = null }) {
  const n = values.length;
  const rho = spearman(values, outcome);
  if (Number.isNaN(rho)) return null;
  const [lo, hi] = bootstrapCI(values, outcome);
  const p = permutationP(values, outcome);
  const row = { name, tier, n, rho, ci: [lo, hi], p };
  if (control) {
    row.partialRho = partialSpearman(values, outcome, control);
    const rv = residualise(rank(values), rank(control));
    const ro = residualise(rank(outcome), rank(control));
    row.partialP = permutationP(rv, ro);
    row.survivesControl = row.partialP < 0.05;
  }
  return row;
}
