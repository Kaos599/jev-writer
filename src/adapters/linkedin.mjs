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

// Shares.csv dates are ISO with a time part. Only the day is ever used.
const ISO_DATE = /^\d{4}-\d{2}-\d{2}/;

// How many offending raw values to quote back. Enough to recognise a format
// change at a glance, few enough that a broken export does not fill the screen.
const DROP_SAMPLES = 3;

const DROP_LABELS = {
  post: 'post row(s) in Shares_*.csv',
  media: 'row(s) in Rich_Media.csv',
  metric: 'analytics row(s) under TOP POSTS',
  follower: 'row(s) in the FOLLOWERS sheet',
};

// Tolerance on the follower back-walk consistency check, as a fraction of the
// headline total. The headline and the daily rows are computed at different
// moments, so an exact match is not expected; a larger disagreement means the
// two are not describing the same window.
const FOLLOWER_TOTAL_TOLERANCE = 0.005;

// Rounding-safe ratio. A zero NUMERATOR is a real outcome and must survive;
// only a zero denominator is undefined.
const ratio = (num, den, digits) =>
  Number.isFinite(num) && Number.isFinite(den) && den !== 0 ? +(num / den).toFixed(digits) : null;

/** One warning per source that lost rows, naming the count and the first few raw values. */
function describeDrops(dropped, warnings) {
  for (const [key, raws] of Object.entries(dropped)) {
    if (!raws.length) continue;
    const sample = raws.slice(0, DROP_SAMPLES).map((r) => JSON.stringify(r)).join(', ');
    warnings.push(
      `${raws.length} ${DROP_LABELS[key]} had an unreadable date and were skipped. ` +
      `First value(s): ${sample}.`,
    );
  }
}

function findFile(dir, re) {
  const hit = readdirSync(dir).find((f) => re.test(f));
  return hit ? join(dir, hit) : null;
}

export function buildCorpus(rawDir, { sinceYears = null } = {}) {
  const warnings = [];
  // Rows whose date will not parse used to vanish without a trace, which made a
  // silently halved corpus look exactly like a small one. Collect them instead;
  // a malformed export is a warning to the user, not a reason to throw.
  const dropped = { post: [], media: [], metric: [], follower: [] };
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
  let posts = [];
  for (const r of parseCsv(readFileSync(sharesPath, 'utf8'))) {
    const date = (r.Date ?? '').trim();
    const text = (r.ShareCommentary ?? '').trim();
    // A reshare with no commentary carries no writing to rate; that is not a
    // parse failure and does not deserve a warning.
    if (!text) continue;
    if (!ISO_DATE.test(date)) { dropped.post.push(date); continue; }
    posts.push({ date, text, share_link: r.ShareLink ?? '', visibility: r.Visibility ?? '' });
  }
  posts.sort((a, b) => a.date.localeCompare(b.date));

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
      if (!dm) { dropped.media.push(raw); continue; }
      const [, mon, day, yr] = /(\w+) (\d{1,2}), (\d{4})/.exec(dm[1]) ?? [];
      const mi = MONTHS.indexOf(mon);
      if (mi < 0) { dropped.media.push(raw); continue; }
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
        else dropped.metric.push(String(c[1]));
      }
      if (String(c[4]).startsWith('http')) {
        const d = parseUsDate(c[5]);
        if (d) metrics.set(d, { ...(metrics.get(d) ?? {}), post_url: c[4], impressions: Math.round(+c[6] || 0) });
        else dropped.metric.push(String(c[5]));
      }
    }

    // Reconstruct follower count at any date by walking back from the total.
    //
    // The sheet gives a headline total at a fixed cell and daily NEW-follower
    // rows after a fixed number of header rows. Both offsets are assumptions
    // about a layout LinkedIn can change without telling anyone, and the
    // headline total is assumed to be the count as of the LAST daily row -
    // which the file never states. If any of that is wrong, every
    // followers_at_post is off by the same amount and every reach_rate is
    // biased in the same direction: the worst kind of error, invisible and
    // systematic.
    //
    // So the assumption is checked before it is used. Walking back from the
    // total must land on a non-negative baseline, because you cannot have
    // gained more followers inside the window than you have in total. A
    // negative baseline, a non-numeric headline, or a daily block that yields
    // no rows at all all mean the layout or the window is not what this code
    // thinks, and each is caught here.
    //
    // On failure the follower map is left empty, which nulls followers_at_post
    // and reach_rate for every post. Falling back to the daily sheet alone is
    // not an option: it carries GAINS, not LEVELS, so it cannot produce a
    // reach_rate at all. A missing reach_rate is honest; a biased one is not.
    const f = sheets.FOLLOWERS ?? [];
    if (f.length) {
      const total = Math.round(Number(f[0]?.[1]));
      const daily = [];
      for (const r of f.slice(3)) {
        const d = parseUsDate(r[0]);
        const n = Number(r[1]);
        if (d && Number.isFinite(n)) daily.push([d, n]);
        else if (String(r[0] ?? '').trim()) dropped.follower.push(String(r[0]));
      }
      daily.sort((a, b) => a[0].localeCompare(b[0]));
      const gained = daily.reduce((s, [, n]) => s + n, 0);
      const baseline = total - gained;
      const slack = Math.max(1, Math.abs(total) * FOLLOWER_TOTAL_TOLERANCE);

      if (!Number.isFinite(total) || total <= 0) {
        warnings.push(
          'The FOLLOWERS sheet has no readable total where one is expected, so the follower ' +
          'count at post time cannot be reconstructed. followers_at_post and reach_rate are null.',
        );
      } else if (!daily.length) {
        warnings.push(
          'The FOLLOWERS sheet has a total but no readable daily rows, so the follower count at ' +
          'post time cannot be reconstructed. followers_at_post and reach_rate are null.',
        );
      } else if (baseline < -slack) {
        warnings.push(
          `The FOLLOWERS sheet is internally inconsistent: it reports ${gained} new followers ` +
          `over the window but a total of only ${total}, so the total is not the count as of the ` +
          `last daily row. Reconstructing from it would bias every reach_rate by a constant, so ` +
          'followers_at_post and reach_rate are null instead.',
        );
      } else {
        let running = total;
        for (let i = daily.length - 1; i >= 0; i--) {
          followersByDate.set(daily[i][0], running);
          running -= daily[i][1];
        }
      }
    }
  }

  describeDrops(dropped, warnings);

  const followerDates = [...followersByDate.keys()].sort();
  const followersAt = (d) => {
    let best = null;
    for (const k of followerDates) { if (k <= d) best = k; else break; }
    // A post older than every follower row has no measured count. Carrying the
    // earliest reconstructed value backwards would be a guess wearing the
    // costume of a measurement, and reach_rate would silently inherit it.
    return best === null ? null : followersByDate.get(best);
  };

  // collisions make the date join ambiguous; report rather than guess
  const perDay = new Map();
  for (const p of posts) perDay.set(p.date.slice(0, 10), (perDay.get(p.date.slice(0, 10)) ?? 0) + 1);
  const collisions = [...perDay].filter(([, n]) => n > 1);
  if (collisions.length) {
    warnings.push(
      `${collisions.length} day(s) have more than one post. The exports cannot be joined on URL, ` +
      `so nothing that belongs to one specific post - metrics, post URL, media type, media count - ` +
      `can be attributed on those days and all of it is left null.`,
    );
  }

  let prev = null;
  const items = posts.map((p, i) => {
    const day = p.date.slice(0, 10);
    const ambiguous = (perDay.get(day) ?? 0) > 1;
    const m = ambiguous ? {} : (metrics.get(day) ?? {});
    // Rich_Media rows carry a date and nothing else that identifies a post, so
    // on a colliding day an upload cannot be tied to one of the day's posts any
    // more than an analytics row can. media_type is a covariate in every model
    // downstream, so a guess here quietly contaminates the results; unknown is
    // the only defensible value.
    const kinds = ambiguous ? null : (media.get(day) ?? new Map());
    const mediaItems = kinds ? [...kinds.values()].reduce((a, b) => a + b, 0) : null;
    const media_type = !kinds ? null
      : kinds.has('video') ? 'video'
      : (kinds.has('feed document') || kinds.has('document')) ? 'document'
      : mediaItems > 1 ? 'carousel'
      : mediaItems === 1 ? 'single_image'
      : 'text_only';

    // Exempt from the collision guard on purpose: the follower count is a
    // per-DAY level, not a per-post attribute, so two posts sharing a date
    // genuinely share the same value. Nothing is being guessed by keeping it.
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
      // Zero engagements on a real post is the single most informative outcome
      // in the file - it is the clearest evidence the writing did not land. A
      // truthiness test here would null it out, and since the drop is not
      // random it would pull every correlation toward "everything I write is
      // fine". Only a zero denominator is genuinely undefined.
      reach_rate: ratio(impressions, followers, 4),
      conversion_rate: ratio(engagements, impressions, 5),
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

  return { items, warnings, dropped, sources: { sharesPath, richPath, xlsxPath } };
}
