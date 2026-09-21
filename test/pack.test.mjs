import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validatePack, toApiQuestions, buildState, countByTier, score, choice, bool } from '../src/rubrics/pack.mjs';
import { linkedinPostPack, directions as linkedinDirections } from '../src/rubrics/linkedin-post.mjs';
import { generalWritingPack, directions as generalDirections } from '../src/rubrics/general-writing.mjs';
import { technicalBlogPack, directions as technicalBlogDirections } from '../src/rubrics/technical-blog.mjs';
import { technicalPostPack, directions as technicalPostDirections } from '../src/rubrics/technical-post.mjs';

const base = {
  id: 'x', version: '1.0.0', description: 'd', stateFields: ['body'],
  questions: { ok: bool('primary', 'Is `body` fine?') },
};

test('the shipped LinkedIn pack is valid', () => {
  assert.deepEqual(validatePack(linkedinPostPack), []);
});

test('the shipped General Writing pack is valid', () => {
  assert.deepEqual(validatePack(generalWritingPack), []);
  const { primary, exploratory } = countByTier(generalWritingPack);
  assert.ok(primary > 0 && exploratory > 0);
  assert.equal(primary + exploratory, Object.keys(generalWritingPack.questions).length);
  for (const [qId, q] of Object.entries(generalWritingPack.questions)) {
    if (q.type === 'score' || q.type === 'boolean') {
      assert.ok(generalDirections[qId], `direction missing for ${qId}`);
    }
  }
});

test('the shipped Technical Blog pack is valid', () => {
  assert.deepEqual(validatePack(technicalBlogPack), []);
  const { primary, exploratory } = countByTier(technicalBlogPack);
  assert.ok(primary > 0 && exploratory > 0);
  assert.equal(primary + exploratory, Object.keys(technicalBlogPack.questions).length);
  for (const [qId, q] of Object.entries(technicalBlogPack.questions)) {
    if (q.type === 'score' || q.type === 'boolean') {
      assert.ok(technicalBlogDirections[qId], `direction missing for ${qId}`);
    }
  }
});

test('the shipped Technical Post pack is valid', () => {
  assert.deepEqual(validatePack(technicalPostPack), []);
  const { primary, exploratory } = countByTier(technicalPostPack);
  assert.ok(primary > 0 && exploratory > 0);
  assert.equal(primary + exploratory, Object.keys(technicalPostPack.questions).length);
  for (const [qId, q] of Object.entries(technicalPostPack.questions)) {
    if (q.type === 'score' || q.type === 'boolean') {
      assert.ok(technicalPostDirections[qId], `direction missing for ${qId}`);
    }
  }
});

test('the shipped pack declares its pre-registration split', () => {
  const { primary, exploratory } = countByTier(linkedinPostPack);
  assert.ok(primary > 0 && exploratory > 0);
  assert.equal(primary + exploratory, Object.keys(linkedinPostPack.questions).length);
});

test('rejects a score with too few or too many levels', () => {
  const one = { ...base, questions: { s: score('primary', 'q', ['only']) } };
  assert.ok(validatePack(one).some((p) => /allows 2-10/.test(p)));
  const many = { ...base, questions: { s: score('primary', 'q', Array(11).fill('lvl')) } };
  assert.ok(validatePack(many).some((p) => /allows 2-10/.test(p)));
});

test('rejects a choice with no no-match option', () => {
  const p = { ...base, questions: { c: choice('primary', 'q', { a: 'A', b: 'B' }) } };
  assert.ok(validatePack(p).some((x) => /no-match/.test(x)));
});

test('rejects an unknown tier, because tier is the pre-registration', () => {
  const p = { ...base, questions: { c: { type: 'boolean', tier: 'maybe', instructions: 'q' } } };
  assert.ok(validatePack(p).some((x) => /tier must be/.test(x)));
});

test('rejects instructions referencing undeclared state', () => {
  const p = { ...base, questions: { q: bool('primary', 'Does `impressions` look high?') } };
  assert.ok(validatePack(p).some((x) => /not in stateFields/.test(x)));
});

test('buildState passes only declared fields, never outcome data', () => {
  const item = { hook_text: 'h', post_body: 'b', preview_text: 'p', impressions: 5000, conversion_rate: 0.04 };
  const state = buildState(linkedinPostPack, item);
  assert.deepEqual(Object.keys(state).sort(), ['hook_text', 'post_body', 'preview_text']);
  assert.equal(state.impressions, undefined);
  assert.equal(state.conversion_rate, undefined);
});

test('toApiQuestions strips tier, which is ours and not part of any API', () => {
  const api = toApiQuestions(linkedinPostPack);
  for (const q of Object.values(api)) assert.equal(q.tier, undefined);
  assert.equal(Object.keys(api).length, Object.keys(linkedinPostPack.questions).length);
});
