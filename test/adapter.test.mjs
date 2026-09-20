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

// --------------------------------------------------------------------------
// buildCorpus fixtures
//
// buildCorpus reads a directory, so these tests write real exports to a temp
// dir. The xlsx is assembled byte by byte rather than mocked: the join logic
// under test depends on the exact sheet layout (a headline total at one fixed
// cell, daily rows after three header rows), and a mock would let that layout
// drift without failing anything.
// --------------------------------------------------------------------------

import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { buildCorpus } from '../src/adapters/linkedin.mjs';

/** Minimal STORED-method zip writer. Enough for readZipEntries, no crc needed. */
function zip(files) {
  const locals = [], centrals = [];
  let offset = 0;
  for (const [name, content] of Object.entries(files)) {
    const nameBuf = Buffer.from(name, 'utf8');
    const data = Buffer.from(content, 'utf8');
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt32LE(data.length, 18);
    local.writeUInt32LE(data.length, 22);
    local.writeUInt16LE(nameBuf.length, 26);
    locals.push(local, nameBuf, data);

    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt32LE(data.length, 20);
    central.writeUInt32LE(data.length, 24);
    central.writeUInt16LE(nameBuf.length, 28);
    central.writeUInt32LE(offset, 42);
    centrals.push(central, nameBuf);
    offset += 30 + nameBuf.length + data.length;
  }
  const body = Buffer.concat(locals);
  const dir = Buffer.concat(centrals);
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);
  eocd.writeUInt16LE(Object.keys(files).length, 8);
  eocd.writeUInt16LE(Object.keys(files).length, 10);
  eocd.writeUInt32LE(dir.length, 12);
  eocd.writeUInt32LE(body.length, 16);
  return Buffer.concat([body, dir, eocd]);
}

const cell = (v) => `<c><v>${v}</v></c>`;
const sheetXml = (rows) =>
  '<worksheet><sheetData>' +
  rows.map((r) => `<row>${r.map(cell).join('')}</row>`).join('') +
  '</sheetData></worksheet>';

/** rows for TOP POSTS: [url, M/D/YYYY, engagements, _, url, M/D/YYYY, impressions, _]. */
function xlsx({ topPosts = [], followers = [] } = {}) {
  const sheets = { 'TOP POSTS': 'sheet1.xml', FOLLOWERS: 'sheet2.xml' };
  return zip({
    'xl/workbook.xml':
      '<workbook><sheets>' +
      '<sheet name="TOP POSTS" sheetId="1" r:id="rId1"/>' +
      '<sheet name="FOLLOWERS" sheetId="2" r:id="rId2"/>' +
      '</sheets></workbook>',
    'xl/_rels/workbook.xml.rels':
      '<Relationships>' +
      '<Relationship Id="rId1" Target="worksheets/sheet1.xml"/>' +
      '<Relationship Id="rId2" Target="worksheets/sheet2.xml"/>' +
      '</Relationships>',
    [`xl/worksheets/${sheets['TOP POSTS']}`]: sheetXml([[''], [''], [''], ...topPosts]),
    [`xl/worksheets/${sheets.FOLLOWERS}`]: sheetXml(followers),
  });
}

/** [total, daily...] in the layout the adapter assumes: total at row 0 col 1, rows from 3. */
const followerSheet = (total, daily) =>
  [['Total followers', total], ['', ''], ['Date', 'New followers'], ...daily];

const SHARES_HEADER = 'Date,ShareLink,ShareCommentary,Visibility\n';
const shareRow = (date, text) => `${date},https://www.linkedin.com/feed/update/urn:li:ugcPost:1,"${text}",MEMBER_NETWORK\n`;

const dirs = [];
function fixture({ shares = [], rich = null, book = null }) {
  const dir = mkdtempSync(join(tmpdir(), 'jev-writer-'));
  dirs.push(dir);
  writeFileSync(join(dir, 'Shares.csv'), SHARES_HEADER + shares.map(([d, t]) => shareRow(d, t)).join(''));
  if (rich) writeFileSync(join(dir, 'Rich_Media.csv'), rich);
  if (book) writeFileSync(join(dir, 'Analytics_export.xlsx'), book);
  return dir;
}

process.on('exit', () => { for (const d of dirs) rmSync(d, { recursive: true, force: true }); });

const RICH_HEADER = 'Date/Time,Media Link\n';
const richRow = (raw) => `"${raw}",https://media.example.com/1\n`;

// --------------------------------------------------------------------------
// same-date collisions
// --------------------------------------------------------------------------

test('a same-date collision leaves media unattributed, not guessed', () => {
  const dir = fixture({
    shares: [
      ['2026-01-02 09:00:00', 'First post of the day about latency work.'],
      ['2026-01-02 17:00:00', 'Second post of the day about hiring.'],
      ['2026-01-05 09:00:00', 'A post on a day of its own.'],
    ],
    rich: RICH_HEADER + richRow('Member uploaded an image on January 2, 2026')
      + richRow('Member uploaded an image on January 5, 2026'),
  });
  const { items } = buildCorpus(dir);
  const colliding = items.filter((i) => i.date.startsWith('2026-01-02'));
  assert.equal(colliding.length, 2);
  for (const i of colliding) {
    assert.equal(i.media_type, null, 'media type cannot be attributed on a colliding day');
    assert.equal(i.media_item_count, null);
  }
  const alone = items.find((i) => i.date.startsWith('2026-01-05'));
  assert.equal(alone.media_type, 'single_image');
  assert.equal(alone.media_item_count, 1);
});

test('a same-date collision leaves metrics and post_url null', () => {
  const dir = fixture({
    shares: [
      ['2026-01-02 09:00:00', 'First post of the day about latency work.'],
      ['2026-01-02 17:00:00', 'Second post of the day about hiring.'],
    ],
    book: xlsx({
      topPosts: [['https://li/p/a', '1/2/2026', '40', '', 'https://li/p/a', '1/2/2026', '900', '']],
      followers: followerSheet(1000, [['1/1/2026', 5], ['1/2/2026', 5]]),
    }),
  });
  const { items } = buildCorpus(dir);
  for (const i of items) {
    assert.equal(i.impressions, null);
    assert.equal(i.engagements, null);
    assert.equal(i.post_url, null);
    assert.equal(i.has_metrics, false);
  }
});

test('followers_at_post survives a collision because it is a per-day level', () => {
  const dir = fixture({
    shares: [
      ['2026-01-02 09:00:00', 'First post of the day about latency work.'],
      ['2026-01-02 17:00:00', 'Second post of the day about hiring.'],
    ],
    book: xlsx({ followers: followerSheet(1000, [['1/1/2026', 5], ['1/2/2026', 5]]) }),
  });
  const { items } = buildCorpus(dir);
  assert.equal(items[0].followers_at_post, 1000);
  assert.equal(items[1].followers_at_post, 1000);
});

// --------------------------------------------------------------------------
// unreadable dates
// --------------------------------------------------------------------------

test('post rows with an unreadable date are counted and quoted, not silently dropped', () => {
  const dir = fixture({
    shares: [
      ['2026-01-02 09:00:00', 'A post that parses.'],
      ['not a date', 'A post whose date is junk.'],
      ['02/03/2026', 'A post in the wrong date format.'],
    ],
  });
  const { items, warnings, dropped } = buildCorpus(dir);
  assert.equal(items.length, 1);
  assert.deepEqual(dropped.post, ['not a date', '02/03/2026']);
  const w = warnings.find((x) => /post row\(s\)/.test(x));
  assert.match(w, /^2 post row\(s\) in Shares_\*\.csv had an unreadable date/);
  assert.match(w, /"not a date", "02\/03\/2026"/);
});

test('unreadable media and analytics dates are surfaced as warnings too', () => {
  const dir = fixture({
    shares: [['2026-01-02 09:00:00', 'A post that parses.']],
    rich: RICH_HEADER + richRow('Member uploaded an image sometime last spring'),
    book: xlsx({ topPosts: [['https://li/p/a', 'Jan 2 2026', '40', '', '', '', '', '']] }),
  });
  const { warnings, dropped } = buildCorpus(dir);
  assert.deepEqual(dropped.media, ['Member uploaded an image sometime last spring']);
  assert.deepEqual(dropped.metric, ['Jan 2 2026']);
  assert.ok(warnings.some((w) => /1 row\(s\) in Rich_Media\.csv had an unreadable date/.test(w)));
  assert.ok(warnings.some((w) => /1 analytics row\(s\) under TOP POSTS had an unreadable date/.test(w)));
});

test('buildCorpus warns about bad dates instead of throwing', () => {
  const dir = fixture({ shares: [['nonsense', 'Every single row is broken.']] });
  const { items, warnings } = buildCorpus(dir);
  assert.equal(items.length, 0);
  assert.ok(warnings.some((w) => /unreadable date/.test(w)));
});

// --------------------------------------------------------------------------
// the follower back-walk
// --------------------------------------------------------------------------

test('a follower total contradicted by the daily rows nulls the derived fields', () => {
  // 500 gained inside a window that ends at a total of 100 is impossible, which
  // proves the headline is not the count as of the last daily row.
  const dir = fixture({
    shares: [['2026-01-02 09:00:00', 'A post with impressions.']],
    book: xlsx({
      topPosts: [['https://li/p/a', '1/2/2026', '40', '', 'https://li/p/a', '1/2/2026', '900', '']],
      followers: followerSheet(100, [['1/1/2026', 200], ['1/2/2026', 300]]),
    }),
  });
  const { items, warnings } = buildCorpus(dir);
  assert.equal(items[0].followers_at_post, null);
  assert.equal(items[0].reach_rate, null);
  assert.equal(items[0].impressions, 900, 'impressions themselves are still trustworthy');
  assert.ok(warnings.some((w) => /internally inconsistent/.test(w)));
});

test('a follower sheet whose layout has moved is rejected rather than trusted', () => {
  const dir = fixture({
    shares: [['2026-01-02 09:00:00', 'A post with impressions.']],
    book: xlsx({
      topPosts: [['https://li/p/a', '1/2/2026', '40', '', 'https://li/p/a', '1/2/2026', '900', '']],
      // Headline cell now holds a label, as it would after a layout change.
      followers: [['Followers', 'Total'], ['', ''], ['Date', 'New followers'], ['1/1/2026', 5]],
    }),
  });
  const { items, warnings } = buildCorpus(dir);
  assert.equal(items[0].followers_at_post, null);
  assert.equal(items[0].reach_rate, null);
  assert.ok(warnings.some((w) => /no readable total/.test(w)));
});

test('a consistent follower sheet is walked back and used', () => {
  const dir = fixture({
    shares: [['2026-03-02 09:00:00', 'A post with impressions.']],
    book: xlsx({
      topPosts: [['https://li/p/a', '3/2/2026', '40', '', 'https://li/p/a', '3/2/2026', '500', '']],
      followers: followerSheet(1000, [['3/1/2026', 10], ['3/2/2026', 20]]),
    }),
  });
  const { items } = buildCorpus(dir);
  assert.equal(items[0].followers_at_post, 1000);
  assert.equal(items[0].reach_rate, 0.5);
});

test('posts older than the follower window get no follower count at all', () => {
  // The earliest reconstructed count is a measurement of March, not of January.
  const dir = fixture({
    shares: [
      ['2026-01-02 09:00:00', 'A post from before the follower window.'],
      ['2026-03-02 09:00:00', 'A post from inside it.'],
    ],
    book: xlsx({
      topPosts: [
        ['https://li/p/a', '1/2/2026', '40', '', 'https://li/p/a', '1/2/2026', '500', ''],
        ['https://li/p/b', '3/2/2026', '40', '', 'https://li/p/b', '3/2/2026', '500', ''],
      ],
      followers: followerSheet(1000, [['3/1/2026', 10], ['3/2/2026', 20]]),
    }),
  });
  const { items } = buildCorpus(dir);
  assert.equal(items[0].followers_at_post, null);
  assert.equal(items[0].reach_rate, null);
  assert.equal(items[1].followers_at_post, 1000);
  assert.equal(items[1].reach_rate, 0.5);
});

// --------------------------------------------------------------------------
// zero is an outcome
// --------------------------------------------------------------------------

test('zero engagements is an outcome, not a missing value', () => {
  // The clearest evidence a post failed must not be the one row excluded from
  // every correlation.
  const dir = fixture({
    shares: [['2026-03-02 09:00:00', 'A post nobody reacted to.']],
    book: xlsx({
      topPosts: [['https://li/p/a', '3/2/2026', '0', '', 'https://li/p/a', '3/2/2026', '500', '']],
      followers: followerSheet(1000, [['3/1/2026', 10], ['3/2/2026', 20]]),
    }),
  });
  const { items } = buildCorpus(dir);
  assert.equal(items[0].engagements, 0);
  assert.equal(items[0].conversion_rate, 0);
  assert.equal(items[0].has_metrics, true);
});

test('zero impressions leaves the ratios undefined rather than infinite', () => {
  const dir = fixture({
    shares: [['2026-03-02 09:00:00', 'A post nobody saw.']],
    book: xlsx({
      topPosts: [['https://li/p/a', '3/2/2026', '0', '', 'https://li/p/a', '3/2/2026', '0', '']],
      followers: followerSheet(1000, [['3/1/2026', 10], ['3/2/2026', 20]]),
    }),
  });
  const { items } = buildCorpus(dir);
  assert.equal(items[0].impressions, 0);
  assert.equal(items[0].conversion_rate, null);
  assert.equal(items[0].reach_rate, 0);
});
