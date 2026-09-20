/**
 * Rubric pack format.
 *
 * A pack is a versioned, portable set of typed questions plus the metadata
 * needed to interpret and validate them. Packs are the extension point: the
 * LinkedIn pack shipped here is one instance, and packs for newsletters, video
 * titles, cold email or documentation are ordinary user-space files.
 *
 * Two fields do real work and are not decoration.
 *
 * `tier` is a pre-registration. A question marked 'primary' is a hypothesis
 * the author committed to before seeing any result; 'exploratory' questions are
 * computed and shown but never reported as findings. Because the pack lives in
 * git, the commit timestamp is the evidence that the commitment came first.
 * Without that, scoring 30 dimensions and reporting whichever three correlate
 * is indistinguishable from making things up.
 *
 * `stateFields` declares exactly which fields a question may see. Jev suffers
 * from context rot - unrelated material in the state measurably costs accuracy
 * - so packs pass the minimum, and the runner asserts that no outcome data
 * (impressions, likes, revenue) can reach the model. A rubric that can see the
 * engagement it is meant to predict is not measuring anything.
 */

export const TIERS = ['primary', 'exploratory'];

/** Score questions accept 2-10 ordered levels; the API rejects anything else. */
export const MIN_SCORE_LEVELS = 2;
export const MAX_SCORE_LEVELS = 10;

/**
 * Validate a pack. Returns an array of human-readable problems; empty is valid.
 * Run this before spending a single API call.
 */
export function validatePack(pack) {
  const problems = [];
  const need = (cond, msg) => { if (!cond) problems.push(msg); };

  need(pack?.id, 'pack is missing an id');
  need(pack?.version, 'pack is missing a version');
  need(pack?.description, 'pack is missing a description');
  need(Array.isArray(pack?.stateFields) && pack.stateFields.length, 'pack declares no stateFields');
  need(pack?.questions && Object.keys(pack.questions).length, 'pack has no questions');
  if (problems.length) return problems;

  const declared = new Set(pack.stateFields);
  for (const [id, q] of Object.entries(pack.questions)) {
    if (!/^[a-z][a-z0-9_]*$/.test(id)) problems.push(`${id}: ids should be snake_case`);
    if (!['score', 'choice', 'boolean'].includes(q.type)) problems.push(`${id}: unknown type "${q.type}"`);
    if (!TIERS.includes(q.tier)) problems.push(`${id}: tier must be one of ${TIERS.join(' | ')}`);
    if (!q.instructions) problems.push(`${id}: missing instructions`);

    if (q.type === 'score') {
      const n = Array.isArray(q.criteria) ? q.criteria.length : 0;
      if (n < MIN_SCORE_LEVELS || n > MAX_SCORE_LEVELS) {
        problems.push(`${id}: score has ${n} levels; the API allows ${MIN_SCORE_LEVELS}-${MAX_SCORE_LEVELS}`);
      }
    }

    if (q.type === 'choice') {
      const opts = Object.keys(q.criteria ?? {});
      if (opts.length < 2) problems.push(`${id}: choice needs at least 2 options`);
      // A Choice with no escape hatch forces a label onto content that fits none
      // of them, which quietly manufactures data.
      if (!opts.some((o) => /^(none_of_these|other|no_match)$/.test(o))) {
        problems.push(`${id}: choice has no no-match option (add none_of_these)`);
      }
    }

    // Backticked references in instructions must point at declared state.
    const refs = JSON.stringify(q.instructions).match(/`([a-z_][a-z0-9_.]*)`/g) ?? [];
    for (const raw of refs) {
      const field = raw.replace(/`/g, '').split('.')[0];
      if (!declared.has(field)) {
        problems.push(`${id}: instructions reference \`${field}\`, which is not in stateFields`);
      }
    }
  }
  return problems;
}

/** Strip our metadata before sending; `tier` is ours, not part of any API. */
export function toApiQuestions(pack) {
  return Object.fromEntries(
    Object.entries(pack.questions).map(([id, { tier, ...rest }]) => [id, rest]),
  );
}

export function tiersOf(pack) {
  return Object.fromEntries(Object.entries(pack.questions).map(([id, q]) => [id, q.tier]));
}

export function countByTier(pack) {
  const t = Object.values(tiersOf(pack));
  return { primary: t.filter((x) => x === 'primary').length, exploratory: t.filter((x) => x === 'exploratory').length };
}

/**
 * Build the state object for one item, restricted to the pack's declared
 * fields. Anything else - including every outcome metric - is dropped rather
 * than trusted not to matter.
 */
export function buildState(pack, item) {
  const state = {};
  for (const f of pack.stateFields) {
    if (item[f] !== undefined && item[f] !== null) state[f] = item[f];
  }
  return state;
}

/** Convenience helpers for pack authors. */
export const score = (tier, instructions, criteria) => ({ type: 'score', tier, instructions, criteria });
export const choice = (tier, instructions, criteria) => ({ type: 'choice', tier, instructions, criteria });
export const bool = (tier, instructions, criteria) => ({ type: 'boolean', tier, instructions, ...(criteria ? { criteria } : {}) });
