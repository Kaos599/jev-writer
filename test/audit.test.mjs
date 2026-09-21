import { test } from 'node:test';
import assert from 'node:assert/strict';
import { writeFileSync, unlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { preparePostState, auditPost, formatAuditTerminal, formatAuditMarkdown } from '../src/audit.mjs';
import { linkedinPostPack } from '../src/rubrics/linkedin-post.mjs';

test('preparePostState splits hook and preview text correctly from string', () => {
  const text = 'This is a long hook line that exceeds sixty characters in length to test splitting properly.\n\nLine 2 is body text that continues for several sentences.';
  const state = preparePostState(text);
  assert.equal(state.hook_text, 'This is a long hook line that exceeds sixty characters in length to test splitting properly.');
  assert.match(state.post_body, /Line 2 is body text/);
  assert.equal(state.preview_text, text.slice(0, 210));
});

test('preparePostState reads from a file path', () => {
  const file = join(tmpdir(), `test-post-${Date.now()}.md`);
  writeFileSync(file, '# Heading\nFirst line of actual content.\nMore body here.');
  try {
    const state = preparePostState(file);
    assert.ok(state.hook_text);
    assert.ok(state.text.includes('First line of actual content'));
  } finally {
    unlinkSync(file);
  }
});

test('preparePostState throws on empty input', () => {
  assert.throws(() => preparePostState('   '), /input text is empty/);
});

test('auditPost evaluates with a mock provider and produces structured ratings', async () => {
  const mockProvider = {
    id: 'mock-gateway',
    label: 'Mock Gateway',
    model: 'mock-jev',
    evaluate: async ({ questions }) => {
      const answers = {};
      for (const [id, q] of Object.entries(questions)) {
        if (q.type === 'score') {
          answers[id] = { type: 'score', value: 2.5, confidence: 0.8 };
        } else if (q.type === 'choice') {
          answers[id] = { type: 'choice', value: Object.keys(q.criteria ?? {})[0] ?? 'none_of_these', confidence: 0.9 };
        } else {
          answers[id] = { type: 'boolean', value: 0.85 };
        }
      }
      return { answers, usage: { inputTokens: 500 } };
    },
  };

  const sample = 'First long hook line of testing that exceeds sixty characters to test properly.\n\nSecond line carrying substance and technical evidence.';
  const res = await auditPost(sample, { pack: linkedinPostPack, provider: mockProvider, reps: 1 });

  assert.equal(res.pack.id, 'linkedin-post');
  assert.equal(res.provider.id, 'mock-gateway');
  assert.equal(typeof res.ratings.hook_strength.value, 'number');
  assert.ok(res.ratings.ai_generated_feel);
  assert.ok(res.tokens > 0);

  const term = formatAuditTerminal(res, linkedinPostPack);
  assert.match(term, /jev-writer audit/);
  assert.match(term, /Attention/);
  assert.match(term, /Craft/);

  const md = formatAuditMarkdown(res, linkedinPostPack);
  assert.match(md, /# Jev Pre-Flight Content Audit/);
  assert.match(md, /### Attention/);
});
