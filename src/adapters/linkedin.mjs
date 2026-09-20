/**
 * LinkedIn adapter.
 *
 * Turns the three first-party exports into one rated-ready corpus. Everything
 * here is first-party and ToS-clean: no scraping, no automation, no vendors.
 *
 *   Shares_*.csv     from Settings > Data Privacy > Get a copy of your data,
 *                    THE LARGER ARCHIVE. The "basic" archive does not contain
 *                    it. All-time post text, dates, URLs. No engagement data
 *                    whatsoever - the Reactions.csv and Comments.csv in the
 *                    same archive record what you did on other people's posts.
 *   Rich_Media.csv   same archive. Yields media type and image count per post.
 *   *Analytics*.xlsx from Creator Mode > Analytics & Tools > Post analytics >
 *                    Export. The only first-party surface with impressions.
 *                    Capped at the top 50 posts and a rolling ~12 months.
 *
 * The exports use different URL formats for the same post - Shares gives
 * /feed/update/urn:li:ugcPost:<id> while analytics gives /posts/<slug> - so
 * they cannot be joined on URL and are joined on date instead. The adapter
 * reports same-day collisions rather than guessing, because two posts on one
 * day make that join ambiguous.
 *
 * Impressions for posts older than the analytics window are not recoverable by
 * any method, including by LinkedIn. Those posts are still rated; they simply
 * carry no outcome, and the statistics treat them as unmeasured rather than as
 * zero.
 */

import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { inflateRawSync } from 'node:zlib';

// LinkedIn collapses the post body behind "see more" at roughly this many
// characters. The exact cut varies by viewport; one constant keeps the derived
// feature comparable across posts.
export const TRUNCATION_CHARS = 210;

// --------------------------------------------------------------------------
// minimal readers (no dependencies)
// --------------------------------------------------------------------------

/** RFC4180-ish CSV parser. LinkedIn embeds newlines and quotes in post text. */
export function parseCsv(text) {
  if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);
  const rows = [];
  let row = [], field = '', inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; }
        else inQuotes = false;
      } else field += c;
    } else if (c === '"') inQuotes = true;
    else if (c === ',') { row.push(field); field = ''; }
    else if (c === '\n') { row.push(field); rows.push(row); row = []; field = ''; }
    else if (c !== '\r') field += c;
  }
  if (field.length || row.length) { row.push(field); rows.push(row); }
  if (!rows.length) return [];
  const header = rows[0].map((h) => h.trim());
  return rows.slice(1).filter((r) => r.some((c) => c.trim())).map((r) =>
    Object.fromEntries(header.map((h, i) => [h, r[i] ?? ''])),
  );
}

/** Read the entries of a ZIP archive. xlsx is a zip of XML parts. */
export function readZipEntries(buf) {
  // Locate the End Of Central Directory record by scanning backwards.
  let eocd = -1;
  for (let i = buf.length - 22; i >= 0 && i > buf.length - 66000; i--) {
    if (buf.readUInt32LE(i) === 0x06054b50) { eocd = i; break; }
  }
  if (eocd < 0) throw new Error('not a zip archive (no end-of-central-directory record)');
  const count = buf.readUInt16LE(eocd + 10);
  let p = buf.readUInt32LE(eocd + 16);

  const out = new Map();
  for (let n = 0; n < count; n++) {
    if (buf.readUInt32LE(p) !== 0x02014b50) break;
    const method = buf.readUInt16LE(p + 10);
    const compSize = buf.readUInt32LE(p + 20);
    const nameLen = buf.readUInt16LE(p + 28);
    const extraLen = buf.readUInt16LE(p + 30);
    const commentLen = buf.readUInt16LE(p + 32);
    const localOff = buf.readUInt32LE(p + 42);
    const name = buf.toString('utf8', p + 46, p + 46 + nameLen);

    // The local header repeats the name/extra lengths, which may differ.
    const lNameLen = buf.readUInt16LE(localOff + 26);
    const lExtraLen = buf.readUInt16LE(localOff + 28);
    const dataStart = localOff + 30 + lNameLen + lExtraLen;
    const raw = buf.subarray(dataStart, dataStart + compSize);
    out.set(name, method === 0 ? raw : inflateRawSync(raw));

    p += 46 + nameLen + extraLen + commentLen;
  }
  return out;
}

const XML_TEXT = /<t[^>]*>([\s\S]*?)<\/t>/g;

function unescapeXml(s) {
  return s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'").replace(/&#(\d+);/g, (_, d) => String.fromCharCode(+d))
    .replace(/&amp;/g, '&');
}

/** Read an xlsx into { sheetName: rows[][] }. Values only; formatting ignored. */
export function readXlsx(buf) {
  const entries = readZipEntries(buf);
  const get = (n) => (entries.has(n) ? entries.get(n).toString('utf8') : null);

  const sharedXml = get('xl/sharedStrings.xml') ?? '';
  const shared = [];
  for (const m of sharedXml.matchAll(/<si>([\s\S]*?)<\/si>/g)) {
    let s = '';
    for (const t of m[1].matchAll(XML_TEXT)) s += t[1];
    shared.push(unescapeXml(s));
  }

  const wb = get('xl/workbook.xml') ?? '';
  const relsXml = get('xl/_rels/workbook.xml.rels') ?? '';
  const rels = new Map();
  for (const m of relsXml.matchAll(/Id="([^"]+)"[^>]*Target="([^"]+)"/g)) rels.set(m[1], m[2]);

  const sheets = {};
  for (const m of wb.matchAll(/<sheet[^>]*name="([^"]+)"[^>]*r:id="([^"]+)"/g)) {
    const name = unescapeXml(m[1]);
    const target = (rels.get(m[2]) ?? '').replace(/^\/?xl\//, '');
    const xml = get('xl/' + target);
    if (!xml) continue;
    const rows = [];
    for (const r of xml.matchAll(/<row[^>]*>([\s\S]*?)<\/row>/g)) {
      const cells = [];
      for (const c of r[1].matchAll(/<c([^>]*)>([\s\S]*?)<\/c>/g)) {
        const isShared = /t="s"/.test(c[1]);
        const isInline = /t="(inlineStr|str)"/.test(c[1]);
        const v = c[2].match(/<v>([\s\S]*?)<\/v>/);
        if (isInline) {
          let s = '';
          for (const t of c[2].matchAll(XML_TEXT)) s += t[1];
          cells.push(unescapeXml(s));
        } else if (!v) cells.push('');
        else cells.push(isShared ? (shared[+v[1]] ?? '') : v[1]);
      }
      rows.push(cells);
    }
    sheets[name] = rows;
  }
  return sheets;
}

// --------------------------------------------------------------------------
// features computed in code, never asked of a model
// --------------------------------------------------------------------------

const EMOJI = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{1F1E6}-\u{1F1FF}]/gu;

export function textFeatures(text) {
  const lines = text.split('\n');
  const nonEmpty = lines.filter((l) => l.trim());
  const words = text.match(/\b[\w'-]+\b/g) ?? [];
  const sentences = text.split(/(?<=[.!?])\s+/).filter((s) => s.trim());
  return {
    char_count: text.length,
    word_count: words.length,
    line_count: lines.length,
    blank_line_count: lines.filter((l) => !l.trim()).length,
    sentence_count: sentences.length,
    avg_sentence_words: sentences.length ? +(words.length / sentences.length).toFixed(2) : 0,
    emoji_count: (text.match(EMOJI) ?? []).length,
    hashtag_count: (text.match(/#\w+/g) ?? []).length,
    url_count: (text.match(/https?:\/\/\S+/g) ?? []).length,
    question_mark_count: (text.match(/\?/g) ?? []).length,
    list_marker_count: nonEmpty.filter((l) => /^\s*(\d+[.)]|[-*>•→])/.test(l)).length,
    is_truncated: text.length > TRUNCATION_CHARS,
    chars_hidden: Math.max(0, text.length - TRUNCATION_CHARS),
    preview_text: text.slice(0, TRUNCATION_CHARS),
  };
}

/** Code owns the hook/body split, so no question has to scope a region itself. */
export function splitHook(text) {
  const lines = text.split('\n').map((l) => l.trim()).filter(Boolean);
  if (!lines.length) return { hook_text: '', post_body: '' };
  // A very short first line is a label, not a hook; absorb the next line.
  if (lines[0].length < 60 && lines.length > 1) {
    return { hook_text: `${lines[0]} ${lines[1]}`, post_body: lines.slice(2).join('\n') };
  }
  return { hook_text: lines[0], post_body: lines.slice(1).join('\n') };
}

// --------------------------------------------------------------------------
// assembly
// --------------------------------------------------------------------------

const RM_DATE = /on (\w+ \d{1,2}, \d{4})/;
const RM_KIND = /uploaded an? ([a-z ]+?) on /;
const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];

const parseUsDate = (s) => {
  const m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec((s ?? '').trim());
  return m ? `${m[3]}-${String(+m[1]).padStart(2, '0')}-${String(+m[2]).padStart(2, '0')}` : null;
};

function findFile(dir, re) {
  const hit = readdirSync(dir).find((f) => re.test(f));
  return hit ? join(dir, hit) : null;
}

export function buildCorpus(rawDir, { sinceYears = null } = {}) {
  const warnings = [];
  const sharesPath = findFile(rawDir, /^Shares.*\.csv$/i);
  if (!sharesPath) {
    throw new Error(
      `No Shares_*.csv in ${rawDir}.\n` +
      'That file is only in the LARGER LinkedIn archive, not the basic one.\n' +
      'Settings > Data Privacy > Get a copy of your data > "Download larger data archive".',
    );
  }
  const richPath = findFile(rawDir, /^Rich_Media\.csv$/i);
  const xlsxPath = findFile(rawDir, /Analytics.*\.xlsx$/i);
  if (!richPath) warnings.push('No Rich_Media.csv found: media type and image count will be missing.');
  if (!xlsxPath) warnings.push('No analytics .xlsx found: no engagement outcomes, so only descriptives are possible.');

  // posts
  let posts = parseCsv(readFileSync(sharesPath, 'utf8'))
    .map((r) => ({ date: (r.Date ?? '').trim(), text: (r.ShareCommentary ?? '').trim(), share_link: r.ShareLink ?? '', visibility: r.Visibility ?? '' }))
    .filter((p) => p.date && p.text)
    .sort((a, b) => a.date.localeCompare(b.date));

  if (sinceYears) {
    const cut = new Date(Date.now() - sinceYears * 365.25 * 864e5).toISOString().slice(0, 10);
    posts = posts.filter((p) => p.date.slice(0, 10) >= cut);
  }

  // media by date
  const media = new Map();
  if (richPath) {
    for (const r of parseCsv(readFileSync(richPath, 'utf8'))) {
      const raw = r['Date/Time'] ?? '';
      const dm = RM_DATE.exec(raw);
      if (!dm) continue;
      const [, mon, day, yr] = /(\w+) (\d{1,2}), (\d{4})/.exec(dm[1]) ?? [];
      const mi = MONTHS.indexOf(mon);
      if (mi < 0) continue;
      const d = `${yr}-${String(mi + 1).padStart(2, '0')}-${String(+day).padStart(2, '0')}`;
      const kind = (RM_KIND.exec(raw) ?? [, 'unknown'])[1];
      if (!media.has(d)) media.set(d, new Map());
      media.get(d).set(kind, (media.get(d).get(kind) ?? 0) + 1);
    }
  }

  // metrics + followers
  const metrics = new Map();
  const followersByDate = new Map();
  if (xlsxPath) {
    const sheets = readXlsx(readFileSync(xlsxPath));
    for (const r of (sheets['TOP POSTS'] ?? []).slice(3)) {
      const c = [...r, '', '', '', '', '', '', '', ''].slice(0, 8);
      if (String(c[0]).startsWith('http')) {
        const d = parseUsDate(c[1]);
        if (d) metrics.set(d, { ...(metrics.get(d) ?? {}), post_url: c[0], engagements: Math.round(+c[2] || 0) });
      }
      if (String(c[4]).startsWith('http')) {
        const d = parseUsDate(c[5]);
        if (d) metrics.set(d, { ...(metrics.get(d) ?? {}), post_url: c[4], impressions: Math.round(+c[6] || 0) });
      }
    }
    // Reconstruct follower count at any date by walking back from the total.
    const f = sheets.FOLLOWERS ?? [];
    if (f.length) {
      const total = Math.round(+f[0][1] || 0);
      const daily = [];
      for (const r of f.slice(3)) {
        const d = parseUsDate(r[0]);
        const n = Number(r[1]);
        if (d && Number.isFinite(n)) daily.push([d, n]);
      }
      daily.sort((a, b) => a[0].localeCompare(b[0]));
      let running = total;
      for (let i = daily.length - 1; i >= 0; i--) {
        followersByDate.set(daily[i][0], running);
        running -= daily[i][1];
      }
    }
  }

  const followerDates = [...followersByDate.keys()].sort();
  const followersAt = (d) => {
    if (!followerDates.length) return null;
    let best = null;
    for (const k of followerDates) { if (k <= d) best = k; else break; }
    return followersByDate.get(best ?? followerDates[0]);
  };

  // collisions make the date join ambiguous; report rather than guess
  const perDay = new Map();
  for (const p of posts) perDay.set(p.date.slice(0, 10), (perDay.get(p.date.slice(0, 10)) ?? 0) + 1);
  const collisions = [...perDay].filter(([, n]) => n > 1);
  if (collisions.length) {
    warnings.push(
      `${collisions.length} day(s) have more than one post. The exports cannot be joined on URL, ` +
      `so metrics for those days cannot be attributed to a specific post and are dropped.`,
    );
  }

  let prev = null;
  const items = posts.map((p, i) => {
    const day = p.date.slice(0, 10);
    const ambiguous = (perDay.get(day) ?? 0) > 1;
    const m = ambiguous ? {} : (metrics.get(day) ?? {});
    const kinds = media.get(day) ?? new Map();
    const mediaItems = [...kinds.values()].reduce((a, b) => a + b, 0);
    const media_type = kinds.has('video') ? 'video'
      : (kinds.has('feed document') || kinds.has('document')) ? 'document'
      : mediaItems > 1 ? 'carousel'
      : mediaItems === 1 ? 'single_image'
      : 'text_only';

    const followers = followersAt(day);
    const impressions = m.impressions ?? null;
    const engagements = m.engagements ?? null;
    const gap = prev ? Math.round((new Date(p.date) - new Date(prev)) / 864e5) : null;
    prev = p.date;

    return {
      id: `p${String(i).padStart(4, '0')}`,
      date: p.date,
      share_link: p.share_link,
      post_url: m.post_url ?? null,
      text: p.text,
      ...splitHook(p.text),
      ...textFeatures(p.text),
      media_type,
      media_item_count: mediaItems,
      impressions,
      engagements,
      followers_at_post: followers,
      reach_rate: impressions && followers ? +(impressions / followers).toFixed(4) : null,
      conversion_rate: impressions && engagements ? +(engagements / impressions).toFixed(5) : null,
      has_metrics: impressions !== null || engagements !== null,
      days_since_previous_post: gap,
      weekday: new Date(p.date).toLocaleDateString('en-US', { weekday: 'long' }),
    };
  });

  const withMetrics = items.filter((i) => i.has_metrics).length;
  if (xlsxPath && withMetrics < items.length) {
    warnings.push(
      `${withMetrics} of ${items.length} posts have engagement data. LinkedIn's analytics export ` +
      `is capped at the top 50 posts over a rolling window, and older engagement is not recoverable by any method.`,
    );
  }

  return { items, warnings, sources: { sharesPath, richPath, xlsxPath } };
}
