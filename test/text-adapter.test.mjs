import { test } from 'node:test';
import assert from 'node:assert/strict';
import { writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { textFeatures, splitHook, parseTextFile, buildTextCorpus } from '../src/adapters/text.mjs';

test('textFeatures accurately counts characters, words, sentences and lines', () => {
  const sample = 'First sentence here. Second sentence with words!\n\nThird sentence on a new line.';
  const f = textFeatures(sample);
  assert.equal(f.char_count, sample.length);
  assert.equal(f.word_count, 13);
  assert.equal(f.line_count, 3);
  assert.equal(f.blank_line_count, 1);
  assert.equal(f.sentence_count, 3);
});

test('splitHook absorbs short first line and leaves remainder as body', () => {
  const shortHook = 'Quick thought:\nThis is the actual hook that explains the context.\nAnd here is the body.';
  const split = splitHook(shortHook);
  assert.equal(split.hook_text, 'Quick thought: This is the actual hook that explains the context.');
  assert.equal(split.post_body, 'And here is the body.');
});

test('splitHook preserves frontmatter-stripped text', () => {
  const withFm = '---\ntitle: Sample\ndate: 2026-09-20\n---\nThis is a long line that serves as the opening hook for this text item.\n\nBody paragraph follows.';
  const split = splitHook(withFm);
  assert.equal(split.hook_text, 'This is a long line that serves as the opening hook for this text item.');
  assert.match(split.post_body, /Body paragraph follows/);
});

test('parseTextFile extracts title and date from frontmatter or heading', () => {
  const testDir = join(tmpdir(), `test-text-${Date.now()}`);
  mkdirSync(testDir, { recursive: true });
  const file1 = join(testDir, 'post1.md');
  const file2 = join(testDir, 'post2.txt');

  writeFileSync(file1, '---\ntitle: Custom Title\ndate: 2026-05-15\n---\nOpening line for testing.\nSecond line.');
  writeFileSync(file2, '# Markdown Heading Title\nJust some plain text content here.');

  try {
    const item1 = parseTextFile(file1);
    assert.equal(item1.title, 'Custom Title');
    assert.equal(item1.date, '2026-05-15');
    assert.equal(item1.hook_text, 'Opening line for testing. Second line.');

    const item2 = parseTextFile(file2);
    assert.equal(item2.title, 'Markdown Heading Title');
    assert.match(item2.hook_text, /Markdown Heading Title/);

    const corpus = buildTextCorpus(testDir);
    assert.equal(corpus.items.length, 2);
    assert.equal(corpus.warnings.length, 0);
  } finally {
    rmSync(testDir, { recursive: true, force: true });
  }
});
