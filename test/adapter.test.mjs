import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseCsv, splitHook, textFeatures, TRUNCATION_CHARS } from '../src/adapters/linkedin.mjs';

test('csv parser handles embedded newlines and escaped quotes', () => {
  // LinkedIn post text routinely contains both.
  const csv = 'Date,ShareCommentary\n2026-01-01 10:00:00,"line one\nline two ""quoted"" end"\n';
  const rows = parseCsv(csv);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].ShareCommentary, 'line one\nline two "quoted" end');
});

test('csv parser strips a BOM', () => {
  assert.deepEqual(Object.keys(parseCsv('﻿a,b\n1,2\n')[0]), ['a', 'b']);
});

test('splitHook absorbs a short label line into the hook', () => {
  const { hook_text, post_body } = splitHook('Quick one:\nThe real opening sentence goes here.\nBody.');
  assert.equal(hook_text, 'Quick one: The real opening sentence goes here.');
  assert.equal(post_body, 'Body.');
});

test('splitHook keeps a long first line as the whole hook', () => {
  const long = 'A'.repeat(80);
  const { hook_text, post_body } = splitHook(`${long}\nsecond\nthird`);
  assert.equal(hook_text, long);
  assert.equal(post_body, 'second\nthird');
});

test('preview_text is cut at the truncation boundary, not by the model', () => {
  const text = 'x'.repeat(500);
  const f = textFeatures(text);
  assert.equal(f.preview_text.length, TRUNCATION_CHARS);
  assert.equal(f.chars_hidden, 500 - TRUNCATION_CHARS);
  assert.equal(f.is_truncated, true);
});

test('short posts are not marked truncated', () => {
  const f = textFeatures('short post');
  assert.equal(f.is_truncated, false);
  assert.equal(f.chars_hidden, 0);
});

test('countable features are counted in code', () => {
  const f = textFeatures('One. Two?\n\n- a\n- b\n#tag #two 🚀 https://example.com');
  assert.equal(f.hashtag_count, 2);
  assert.equal(f.list_marker_count, 2);
  assert.equal(f.url_count, 1);
  assert.equal(f.question_mark_count, 1);
  assert.equal(f.emoji_count, 1);
  assert.ok(f.blank_line_count >= 1);
});
