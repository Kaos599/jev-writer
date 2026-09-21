/**
 * Build the dashboard: one self-contained HTML file with inline CSS, inline JS
 * and the data embedded. No CDN, no fetch, no build step. It opens over
 * file:// on a laptop with no network.
 *
 * The presentation contract:
 *   - no statistics vocabulary anywhere except the collapsed methods section;
 *   - every rubric judgment appears as a coloured band, never as a raw number;
 *   - bands arrive direction-aware from the report and are never recomputed
 *     here, so a low score on a dimension where low is good still paints green;
 *   - charts only where a chart genuinely says something;
 *   - zero emojis anywhere in the UI chrome; all iconography is pure SVG.
 *
 * This module does no I/O. It takes the object `buildReport` returned and gives
 * back a string. The CLI owns reading and writing files.
 */

import { DIMENSION_LABELS } from './report.mjs';

const labelFor = (d) => DIMENSION_LABELS[d] ?? d.replace(/_/g, ' ');

/**
 * Judgments are grouped into families for the expanded post view.
 */
function groupsFor(pack, dims) {
  const declared = Array.isArray(pack?.groups) ? pack.groups : [];
  const placed = new Set(declared.flatMap((g) => g.dims));
  const leftover = dims.filter((d) => !placed.has(d));
  const groups = declared
    .map((g) => ({ ...g, dims: g.dims.filter((d) => dims.includes(d)) }))
    .filter((g) => g.dims.length);
  if (leftover.length) groups.push({ key: 'other', title: groups.length ? 'Other judgments' : 'Judgments', dims: leftover });
  return groups;
}

/**
 * Clean text from CSV imports.
 */
function cleanText(raw) {
  if (!raw) return '';
  const lines = String(raw)
    .split('\n')
    .map((l) => l.trim().replace(/^"+/, '').replace(/"+$/, '').trim());
  const out = [];
  for (const l of lines) {
    if (!l && !out.length) continue;
    if (!l && !out[out.length - 1]) continue;
    out.push(l);
  }
  while (out.length && !out[out.length - 1]) out.pop();
  return out.join('\n');
}

const titleCase = (s) => s.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

/** Choice answers are not bands; they get shown as plain descriptive chips. */
function choiceAnswers(ratings) {
  const out = {};
  for (const [k, v] of Object.entries(ratings ?? {})) {
    if (v && v.type === 'choice' && v.value != null) out[k] = titleCase(String(v.value));
  }
  return out;
}

/**
 * Question counts for the methods appendix.
 */
function questionCounts(pack, dims) {
  const qs = pack?.questions ? Object.values(pack.questions) : null;
  if (!qs) return { total: dims.length, primary: null, exploratory: null };
  return {
    total: qs.length,
    primary: qs.filter((q) => q.tier === 'primary').length,
    exploratory: qs.filter((q) => q.tier === 'exploratory').length,
  };
}

/**
 * Compute breakdown summaries across choice categories and media types.
 */
function computeBreakdowns(posts) {
  const withMetrics = posts.filter((p) => p.hasMetrics && p.reach != null);
  if (withMetrics.length < 5) return null;

  const med = (xs) => {
    const valid = xs.filter((x) => x != null && Number.isFinite(x)).sort((a, b) => a - b);
    if (!valid.length) return null;
    const mid = Math.floor(valid.length / 2);
    return valid.length % 2 !== 0 ? valid[mid] : (valid[mid - 1] + valid[mid]) / 2;
  };

  const group = (keyFn) => {
    const map = new Map();
    for (const p of withMetrics) {
      const k = keyFn(p);
      if (!k || k === 'None Of These' || k === 'Unknown') continue;
      const arr = map.get(k) ?? [];
      arr.push(p);
      map.set(k, arr);
    }
    return [...map.entries()]
      .filter(([_, arr]) => arr.length >= 2)
      .map(([label, arr]) => ({
        label,
        count: arr.length,
        medianReach: med(arr.map((p) => p.reach)),
        medianConv: med(arr.map((p) => p.conv)),
        avgImpressions: Math.round(arr.reduce((a, b) => a + (b.impressions || 0), 0) / arr.length),
      }))
      .sort((a, b) => b.count - a.count || (b.medianReach ?? 0) - (a.medianReach ?? 0));
  };

  const formats = group((p) => p.choices?.post_format);
  const hooks = group((p) => p.choices?.hook_archetype);
  const media = group((p) => (p.media ? titleCase(p.media) : null));
  const tones = group((p) => p.choices?.emotional_register);

  return { formats, hooks, media, tones };
}

/**
 * Reshape the report into the payload the page embeds.
 */
function buildData(report, { ratings = [], pack = null, platform = null } = {}) {
  const choices = new Map();
  for (const row of ratings) {
    choices.set(row.id, { ...(choices.get(row.id) ?? {}), ...choiceAnswers(row.ratings) });
  }
  const validated = report.validated.map((v) => (typeof v === 'string' ? v : v.dimension));

  const slim = report.posts.map((p) => {
    const text = cleanText(p.text || '');
    return {
      id: p.id,
      date: p.date,
      url: p.post_url || p.share_link || null,
      text,
      snippet: text.replace(/\s+/g, ' ').slice(0, 190),
      words: p.word_count ?? null,
      media: p.media_type ?? null,
      hasMetrics: !!p.has_metrics,
      impressions: p.impressions ?? null,
      engagements: p.engagements ?? null,
      followers: p.followers_at_post ?? null,
      reach: p.reach_rate ?? null,
      conv: p.conversion_rate ?? null,
      grade: p.grade ? p.grade.score : null,
      bands: Object.fromEntries(Object.entries(p.bands || {}).map(([k, b]) => [k, [b.band, b.label, b.hint]])),
      choices: choices.get(p.id) ?? {},
      fixes: p.fixes ?? [],
    };
  });

  const allDims = [...new Set(report.posts.flatMap((p) => Object.keys(p.bands ?? {})))];
  const groups = groupsFor(pack, allDims);
  const dimLabels = {};
  for (const d of allDims) dimLabels[d] = labelFor(d);
  for (const g of groups) for (const d of g.dims) dimLabels[d] = labelFor(d);

  const breakdowns = computeBreakdowns(slim);

  // Compute total tracked volume & Hall of Fame top outliers
  const postsWithMetrics = slim.filter((p) => p.hasMetrics && p.reach != null);
  const totalTrackedImpressions = postsWithMetrics.reduce((a, b) => a + (b.impressions || 0), 0);

  const topReach = postsWithMetrics.length
    ? [...postsWithMetrics].sort((a, b) => (b.reach || 0) - (a.reach || 0))[0]
    : null;
  const topEngage = postsWithMetrics.length
    ? [...postsWithMetrics].filter((p) => p.conv != null).sort((a, b) => (b.conv || 0) - (a.conv || 0))[0]
    : null;
  const topImpressions = postsWithMetrics.length
    ? [...postsWithMetrics].sort((a, b) => (b.impressions || 0) - (a.impressions || 0))[0]
    : null;

  return {
    generatedAt: report.generatedAt,
    pack: report.pack,
    summary: report.summary,
    corpus: report.corpus,
    outcomes: report.outcomes,
    findings: report.findings,
    weakSpots: report.weakSpots,
    validated,
    power: report.power,
    writingPrompt: report.writingPrompt,
    groups,
    platform,
    questionCounts: questionCounts(pack, allDims),
    corpusAvailable: !!report.corpus,
    dimLabels,
    breakdowns,
    totalTrackedImpressions,
    topPosts: {
      topReach,
      topEngage,
      topImpressions,
    },
    posts: slim,
  };
}

/* ------------------------------------------------------------------ charts */

const esc = (s) =>
  String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** Posting volume by year. */
function volumeChart(rows, muteIndex = -1) {
  const W = 640, H = 220, padL = 20, padR = 20, padT = 24, padB = 32;
  const max = Math.max(...rows.map((r) => r.posts), 1);
  const plotW = W - padL - padR, plotH = H - padT - padB;
  const slot = plotW / rows.length;
  const bw = Math.min(84, slot * 0.52);
  let bars = '';
  rows.forEach((r, i) => {
    const h = Math.max(4, (r.posts / max) * plotH);
    const x = padL + slot * i + (slot - bw) / 2;
    const y = padT + plotH - h;
    const hi = i === muteIndex;
    bars +=
      `<g class="chart-col">` +
      `<rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${bw.toFixed(1)}" height="${h.toFixed(1)}" rx="6" ` +
      `class="${hi ? 'bar bar-muted' : 'bar'}"/>` +
      `<text x="${(x + bw / 2).toFixed(1)}" y="${(y - 8).toFixed(1)}" class="bar-val" text-anchor="middle">${r.posts}</text>` +
      `<text x="${(x + bw / 2).toFixed(1)}" y="${(H - 10).toFixed(1)}" class="bar-lab" text-anchor="middle">${esc(r.year)}</text>` +
      `</g>`;
  });
  return (
    `<svg viewBox="0 0 ${W} ${H}" class="chart" role="img" ` +
    `aria-label="Posts published each year: ${rows.map((r) => `${r.year}, ${r.posts}`).join('; ')}">` +
    `<line x1="${padL}" y1="${padT + plotH + 0.5}" x2="${W - padR}" y2="${padT + plotH + 0.5}" class="axis"/>` +
    bars +
    `</svg>`
  );
}

/** Follower growth over time. */
function followerChart(points) {
  const W = 640, H = 220, padL = 48, padR = 20, padT = 22, padB = 32;
  if (!points || points.length < 2) return '';
  const xs = points.map((p) => new Date(p.date).getTime());
  const ys = points.map((p) => p.followers);
  const x0 = Math.min(...xs), x1 = Math.max(...xs);
  const y0 = Math.min(...ys), y1 = Math.max(...ys);
  const plotW = W - padL - padR, plotH = H - padT - padB;
  const px = (t) => padL + ((t - x0) / (x1 - x0 || 1)) * plotW;
  const py = (v) => padT + plotH - ((v - y0) / (y1 - y0 || 1)) * plotH;
  const d = points.map((p, i) => `${i ? 'L' : 'M'}${px(new Date(p.date).getTime()).toFixed(1)} ${py(p.followers).toFixed(1)}`).join('');
  const area = `${d}L${px(x1).toFixed(1)} ${(padT + plotH).toFixed(1)}L${px(x0).toFixed(1)} ${(padT + plotH).toFixed(1)}Z`;
  const years = [...new Set(points.map((p) => String(p.date).slice(0, 4)))];
  let ticks = '';
  for (const y of years) {
    const first = points.find((p) => String(p.date).slice(0, 4) === y);
    ticks += `<text x="${px(new Date(first.date).getTime()).toFixed(1)}" y="${H - 10}" class="bar-lab" text-anchor="middle">${esc(y)}</text>`;
  }
  const fmt = (v) => (v >= 1000 ? `${(v / 1000).toFixed(1)}k` : String(v));
  return (
    `<svg viewBox="0 0 ${W} ${H}" class="chart" role="img" aria-label="Follower count over time, from ${fmt(y0)} to ${fmt(y1)}">` +
    `<defs>` +
    `<linearGradient id="followerAreaGrad" x1="0" y1="0" x2="0" y2="1">` +
    `<stop offset="0%" stop-color="var(--accent)" stop-opacity="0.28"/>` +
    `<stop offset="100%" stop-color="var(--accent)" stop-opacity="0.0"/>` +
    `</linearGradient>` +
    `</defs>` +
    `<line x1="${padL}" y1="${padT + 0.5}" x2="${W - padR}" y2="${padT + 0.5}" class="gridline"/>` +
    `<line x1="${padL}" y1="${(padT + plotH + 0.5).toFixed(1)}" x2="${W - padR}" y2="${(padT + plotH + 0.5).toFixed(1)}" class="axis"/>` +
    `<text x="${padL - 10}" y="${padT + 5}" class="bar-lab" text-anchor="end">${fmt(y1)}</text>` +
    `<text x="${padL - 10}" y="${padT + plotH}" class="bar-lab" text-anchor="end">${fmt(y0)}</text>` +
    `<path d="${area}" class="area" fill="url(#followerAreaGrad)"/><path d="${d}" class="line"/>` +
    ticks +
    `</svg>`
  );
}

/**
 * Breakdown comparison chart (formats, hook archetypes, media, or tones).
 */
function breakdownSvg(items, title) {
  if (!items || !items.length) return '';
  const W = 640, rowH = 46, padL = 175, padR = 120, padT = 20, padB = 14;
  const H = padT + items.length * rowH + padB;
  const plotW = W - padL - padR;
  const maxReach = Math.max(...items.map((i) => i.medianReach ?? 0), 0.05);

  let rows = '';
  items.forEach((item, idx) => {
    const y = padT + idx * rowH;
    const reachW = item.medianReach != null ? Math.max(4, (item.medianReach / maxReach) * plotW) : 0;
    const reachPct = item.medianReach != null ? (item.medianReach * 100).toFixed(1) + '%' : '–';
    const convPct = item.medianConv != null ? (item.medianConv * 100).toFixed(1) + '%' : '–';

    rows +=
      `<g class="breakdown-row" tabindex="0">` +
      `<text x="${padL - 12}" y="${y + 17}" class="bar-lab" text-anchor="end" font-weight="600">${esc(item.label)} <tspan fill="var(--fg-faint)">(${item.count})</tspan></text>` +
      `<rect x="${padL}" y="${y + 4}" width="${plotW}" height="18" rx="4" class="track-bg"/>` +
      `<rect x="${padL}" y="${y + 4}" width="${reachW.toFixed(1)}" height="18" rx="4" class="bar-reach"/>` +
      `<text x="${padL + plotW + 10}" y="${y + 17}" class="bar-val-sub" text-anchor="start">${reachPct} reach · ${convPct} eng</text>` +
      `</g>`;
  });

  return (
    `<svg viewBox="0 0 ${W} ${H}" class="chart breakdown-chart" role="img" aria-label="${esc(title)}: ${items.map((i) => `${i.label} (${i.count})`).join(', ')}">` +
    rows +
    `</svg>`
  );
}

/* ------------------------------------------------------------- vector icons */

const ICONS = {
  overview: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 3v18h18"/><path d="m19 9-5 5-4-4-3 3"/></svg>`,
  formats: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/></svg>`,
  posts: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>`,
  blueprint: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M13 2 3 14h9l-1 8 10-12h-9l1-8z"/></svg>`,
  methods: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 18h8"/><path d="M3 22h18"/><path d="M14 22a7 7 0 1 0-4-12.7"/><path d="M10 2v4"/><path d="M14 2v4"/></svg>`,
  formatLayer: `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 2 7 12 12 22 7 12 2"/><polyline points="2 17 12 22 22 17"/><polyline points="2 12 12 17 22 12"/></svg>`,
  shieldAlert: `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>`,
  messageCircle: `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/></svg>`,
  medal: `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="8" r="6"/><path d="M15.477 12.89 17 22l-5-3-5 3 1.523-9.11"/></svg>`,
  chat: `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>`,
  eye: `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>`,
  arrowRight: `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg>`,
  copy: `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>`,
  cards: `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>`,
  table: `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg>`,
  sparkle: `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z"/></svg>`
};

/* -------------------------------------------------------------------- css */

function css() {
  return `
:root{
  --bg:#fafafa; --surface:#ffffff; --surface-2:#f4f4f5; --surface-hover:#e4e4e7;
  --border:#e4e4e7; --border-strong:#d4d4d8;
  --fg:#09090b; --fg-muted:#52525b; --fg-faint:#71717a;
  --primary:#09090b; --primary-fg:#ffffff;
  --accent:#ea580c; --accent-hover:#c2410c; --accent-fg:#ffffff; --accent-soft:rgba(234,88,12,.09);
  --ok:#16a34a; --ok-bg:rgba(22,163,74,.10); --ok-br:rgba(22,163,74,.25);
  --good:#0d9488; --good-bg:rgba(13,148,136,.10); --good-br:rgba(13,148,136,.25);
  --mid:#71717a; --mid-bg:rgba(113,113,122,.10); --mid-br:rgba(113,113,122,.22);
  --warn:#d97706; --warn-bg:rgba(217,119,6,.12); --warn-br:rgba(217,119,6,.28);
  --bad:#e11d48; --bad-bg:rgba(225,29,72,.10); --bad-br:rgba(225,29,72,.25);
  --shadow-border:0px 0px 0px 1px rgba(0,0,0,.06),0px 1px 2px -1px rgba(0,0,0,.06),0px 2px 4px 0px rgba(0,0,0,.04);
  --shadow-border-hover:0px 0px 0px 1px rgba(0,0,0,.08),0px 1px 2px -1px rgba(0,0,0,.08),0px 2px 4px 0px rgba(0,0,0,.06);
  --radius-lg:12px; --radius-md:8px; --radius-sm:6px; --radius-xs:4px; --radius:12px;
}
@media (prefers-color-scheme: dark){
  :root:not([data-theme="light"]){
    --bg:#09090b; --surface:#121215; --surface-2:#18181c; --surface-hover:#222228;
    --border:rgba(255,255,255,.08); --border-strong:rgba(255,255,255,.16);
    --fg:#f4f4f5; --fg-muted:#a1a1aa; --fg-faint:#71717a;
    --primary:#f4f4f5; --primary-fg:#09090b;
    --accent:#fb923c; --accent-hover:#fdba74; --accent-fg:#09090b; --accent-soft:rgba(251,146,60,.12);
    --ok:#22c55e; --ok-bg:rgba(34,197,94,.12); --ok-br:rgba(34,197,94,.28);
    --good:#14b8a6; --good-bg:rgba(20,184,166,.12); --good-br:rgba(20,184,166,.28);
    --mid:#a1a1aa; --mid-bg:rgba(161,161,170,.12); --mid-br:rgba(161,161,170,.24);
    --warn:#f59e0b; --warn-bg:rgba(245,158,11,.13); --warn-br:rgba(245,158,11,.28);
    --bad:#fb7185; --bad-bg:rgba(251,113,133,.13); --bad-br:rgba(251,113,133,.28);
    --shadow-border:0 0 0 1px rgba(255,255,255,.08);
    --shadow-border-hover:0 0 0 1px rgba(255,255,255,.14);
  }
}
:root[data-theme="dark"]{
  --bg:#09090b; --surface:#121215; --surface-2:#18181c; --surface-hover:#222228;
  --border:rgba(255,255,255,.08); --border-strong:rgba(255,255,255,.16);
  --fg:#f4f4f5; --fg-muted:#a1a1aa; --fg-faint:#71717a;
  --primary:#f4f4f5; --primary-fg:#09090b;
  --accent:#fb923c; --accent-hover:#fdba74; --accent-fg:#09090b; --accent-soft:rgba(251,146,60,.12);
  --ok:#22c55e; --ok-bg:rgba(34,197,94,.12); --ok-br:rgba(34,197,94,.28);
  --good:#14b8a6; --good-bg:rgba(20,184,166,.12); --good-br:rgba(20,184,166,.28);
  --mid:#a1a1aa; --mid-bg:rgba(161,161,170,.12); --mid-br:rgba(161,161,170,.24);
  --warn:#f59e0b; --warn-bg:rgba(245,158,11,.13); --warn-br:rgba(245,158,11,.28);
  --bad:#fb7185; --bad-bg:rgba(251,113,133,.13); --bad-br:rgba(251,113,133,.28);
  --shadow-border:0 0 0 1px rgba(255,255,255,.08);
  --shadow-border-hover:0 0 0 1px rgba(255,255,255,.14);
}

*,*::before,*::after{box-sizing:border-box}
html{-webkit-text-size-adjust:100%; scroll-behavior:smooth; -webkit-font-smoothing:antialiased; -moz-osx-font-smoothing:grayscale}
body{
  margin:0; background:var(--bg); color:var(--fg);
  font-family:ui-sans-serif,-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,"Inter",Helvetica,Arial,sans-serif;
  font-size:14.5px; line-height:1.55; -webkit-font-smoothing:antialiased; -moz-osx-font-smoothing:grayscale; overflow-x:hidden;
}
.num,.tnum,.stat-v,.tbl-num,.bar-val,.bar-val-sub,.hof-stat-main,.tab-count,.count-pill,.meta-tag{
  font-variant-numeric:tabular-nums; font-feature-settings:"tnum" 1;
}
h1,h2,h3,h4,.stat-k,.hof-title h3,.takeaways-head{text-wrap:balance}
p,.lede,.stat-d,.takeaway-item p,.hof-snip,.aud-text,.methods-body p{text-wrap:pretty}
.wrap{max-width:1120px; margin:0 auto; padding:0 20px}
a{color:var(--accent); text-decoration:none}
a:hover{text-decoration:underline}

/* top nav header */
.top{position:sticky; top:0; z-index:40; background:color-mix(in srgb,var(--bg) 85%,transparent);
  backdrop-filter:saturate(1.5) blur(12px); border-bottom:1px solid var(--border)}
.top-in{display:flex; align-items:center; gap:12px; min-height:56px}
.brand{font-weight:700; letter-spacing:-.02em; font-size:14.5px; display:flex; align-items:center; gap:8px; text-decoration:none; color:inherit; flex-shrink:0}
.brand-icon{display:inline-flex; align-items:center; justify-content:center; color:var(--accent)}
.brand-badge{font-size:10px; font-weight:700; text-transform:uppercase; letter-spacing:.06em;
  padding:2px 7px; border-radius:5px; background:var(--accent-soft); color:var(--accent); border:1px solid var(--border-strong)}
.meta-tag{font-size:11.5px; font-weight:500; color:var(--fg-faint); margin-left:4px}

.nav-tabs{display:flex; gap:3px; margin-left:auto; overflow-x:auto; scrollbar-width:none}
.nav-tabs::-webkit-scrollbar{display:none}
/* optical alignment: icon on left (11px) vs text on right (13px) */
.tab-btn{border:0; background:transparent; color:var(--fg-muted); font-size:12.5px; font-weight:600;
  padding:7px 13px 7px 11px; min-height:38px; border-radius:7px; cursor:pointer; display:inline-flex; align-items:center; gap:6px;
  white-space:nowrap; transition-property:color,background-color,box-shadow,transform; transition-duration:150ms; transition-timing-function:cubic-bezier(0.16,1,0.3,1)}
.tab-btn:hover{background:var(--surface-2); color:var(--fg)}
.tab-btn.active{background:var(--surface-2); color:var(--fg); font-weight:700; box-shadow:inset 0 -2px 0 0 var(--accent), inset 0 0 0 1px var(--border-strong)}
.tab-btn:active{transform:scale(0.96)}
.tab-count{font-size:10.5px; padding:1px 5px; border-radius:99px; background:var(--border); color:var(--fg-muted); font-weight:600}

.btn-group{display:flex; align-items:center; gap:6px; flex-shrink:0}
.pillbtn{border:1px solid var(--border); background:var(--surface); color:var(--fg-muted);
  padding:6px 13px 6px 11px; min-height:34px; border-radius:99px; font-size:11.5px; font-weight:600; cursor:pointer;
  transition-property:color,background-color,border-color,transform; transition-duration:150ms; transition-timing-function:cubic-bezier(0.16,1,0.3,1); display:inline-flex; align-items:center; gap:5px}
.pillbtn:hover{color:var(--fg); border-color:var(--border-strong); background:var(--surface-2)}
.pillbtn.active{background:var(--accent); color:var(--accent-fg); border-color:var(--accent)}
.pillbtn:active{transform:scale(0.96)}

/* minimum 40x40px hit area on icon buttons */
.iconbtn{flex:none; position:relative; border:1px solid var(--border); background:var(--surface); color:var(--fg-muted);
  width:36px; height:36px; border-radius:8px; cursor:pointer; display:flex; align-items:center;
  justify-content:center; transition-property:color,background-color,border-color,transform; transition-duration:150ms; transition-timing-function:cubic-bezier(0.16,1,0.3,1)}
.iconbtn::after{content:""; position:absolute; top:50%; left:50%; transform:translate(-50%,-50%); width:44px; height:44px}
.iconbtn:hover{color:var(--fg); border-color:var(--border-strong); background:var(--surface-2)}
.iconbtn:active{transform:scale(0.96)}

/* hero section */
.hero{padding:24px 0 14px}
.hero-tag{display:inline-flex; align-items:center; gap:6px; font-size:10.5px; font-weight:700;
  letter-spacing:.07em; text-transform:uppercase; color:var(--accent); margin-bottom:6px}
h1{font-size:clamp(24px,3.4vw,34px); line-height:1.15; letter-spacing:-.03em; margin:0 0 8px; font-weight:800}
.lede{font-size:clamp(14px,1.6vw,15.5px); color:var(--fg-muted); max-width:68ch; margin:0 0 18px; line-height:1.5}

/* cards & layout: concentric borders & subtle layered shadows */
.card{background:var(--surface); box-shadow:var(--shadow-border); border-radius:var(--radius-lg);
  transition-property:box-shadow,border-color; transition-duration:150ms; transition-timing-function:cubic-bezier(0.16,1,0.3,1)}
.card:hover{box-shadow:var(--shadow-border-hover)}
.pad{padding:18px 20px}
.grid{display:grid; gap:14px}
.kpi-grid{grid-template-columns:repeat(auto-fit,minmax(min(190px,100%),1fr))}
.two-col{grid-template-columns:repeat(auto-fit,minmax(min(320px,100%),1fr))}
.three-col{grid-template-columns:repeat(auto-fit,minmax(min(280px,100%),1fr))}

/* stat cards */
.stat-k{font-size:10.5px; font-weight:700; color:var(--fg-muted); text-transform:uppercase; letter-spacing:.06em}
.stat-v{font-size:clamp(24px,3.6vw,32px); font-weight:800; letter-spacing:-.03em; line-height:1.15; margin:5px 0 2px}
.stat-d{font-size:12px; color:var(--fg-muted); line-height:1.45}
.stat-v .nodata{font-size:.55em; font-weight:550; opacity:.6; letter-spacing:0}
.unit{font-size:15px; font-weight:600; color:var(--fg-muted); margin-left:2px}
.stat-subpill{display:inline-block; font-size:10.5px; font-weight:600; padding:2px 6px; border-radius:var(--radius-xs);
  background:var(--surface-2); color:var(--fg-faint); margin-top:5px}

/* key takeaways banner: concentric radii (14px outer, 8px inner icon) */
.takeaways-banner{background:var(--surface-2); box-shadow:var(--shadow-border); border-radius:14px;
  padding:18px 22px; margin-bottom:24px}
.takeaways-head{display:flex; align-items:center; gap:7px; font-size:12px; font-weight:700;
  text-transform:uppercase; letter-spacing:.07em; color:var(--accent); margin-bottom:14px}
.takeaways-grid{display:grid; grid-template-columns:repeat(auto-fit,minmax(280px,1fr)); gap:16px}
.takeaway-item{display:flex; gap:12px; align-items:flex-start}
.takeaway-icon{flex:none; width:28px; height:28px; border-radius:var(--radius-md); display:flex; align-items:center;
  justify-content:center; background:var(--accent-soft); color:var(--accent); margin-top:2px}
.takeaway-item h4{margin:0 0 3px; font-size:13.5px; font-weight:700}
.takeaway-item p{margin:0; font-size:12.5px; color:var(--fg-muted); line-height:1.45}

/* hall of fame: concentric radii (12px outer card, 6px inner badge) */
.hof-title{display:flex; justify-content:space-between; align-items:baseline; margin:28px 0 12px}
.hof-title h3{margin:0; font-size:16px; font-weight:750; letter-spacing:-.015em}
.hof-sub{font-size:12.5px; color:var(--fg-faint)}
.hof-card{position:relative; display:flex; flex-direction:column; justify-content:space-between;
  padding:18px 20px; border-radius:var(--radius-lg); background:var(--surface); box-shadow:var(--shadow-border);
  transition-property:box-shadow,transform; transition-duration:150ms; transition-timing-function:cubic-bezier(0.16,1,0.3,1)}
.hof-card:hover{box-shadow:var(--shadow-border-hover)}
.hof-badge{display:inline-flex; align-items:center; gap:5px; font-size:10.5px; font-weight:700;
  text-transform:uppercase; letter-spacing:.06em; padding:2px 7px; border-radius:var(--radius-sm); margin-bottom:10px}
.hof-gold{background:rgba(245,158,11,.12); color:var(--warn); border:1px solid rgba(245,158,11,.25)}
.hof-emerald,.hof-blue{background:rgba(34,197,94,.12); color:var(--ok); border:1px solid rgba(34,197,94,.25)}
.hof-amber,.hof-purple{background:rgba(251,146,60,.12); color:var(--accent); border:1px solid rgba(251,146,60,.25)}
.hof-stats{display:flex; gap:10px; align-items:baseline; margin-bottom:8px}
.hof-stat-main{font-size:22px; font-weight:800; letter-spacing:-.02em}
.hof-stat-sub{font-size:12px; color:var(--fg-muted)}
.hof-snip{font-size:13px; color:var(--fg); line-height:1.5; margin:0 0 14px;
  display:-webkit-box; -webkit-line-clamp:3; -webkit-box-orient:vertical; overflow:hidden}
/* optical alignment: text left (8px) vs arrow right (6px) */
.hof-action{margin-top:auto; font-size:12px; font-weight:600; color:var(--accent); cursor:pointer;
  background:none; border:0; padding:4px 6px 4px 8px; text-align:left; display:inline-flex; align-items:center; gap:5px;
  transition-property:color,transform; transition-duration:150ms; transition-timing-function:cubic-bezier(0.16,1,0.3,1)}
.hof-action:hover{text-decoration:underline}
.hof-action:active{transform:scale(0.96)}

/* charts */
.chart-box h3{margin:0 0 4px; font-size:15px; font-weight:700}
.chart-box .sub{margin:0 0 14px; font-size:13px; color:var(--fg-muted)}
.chart{width:100%; height:auto; display:block; overflow:visible}
.bar{fill:var(--accent); transition-property:opacity; transition-duration:150ms; transition-timing-function:ease-out}
.bar-muted{fill:var(--mid); opacity:.45}
.bar-val{fill:var(--fg); font-size:12px; font-weight:650}
.bar-lab{fill:var(--fg-muted); font-size:11px}
.axis{stroke:var(--border-strong)}
.gridline{stroke:var(--border); stroke-dasharray:3 4}
.line{fill:none; stroke:var(--accent); stroke-width:2.25; stroke-linejoin:round; stroke-linecap:round}
.area{stroke:none}
.note{font-size:11.5px; color:var(--fg-faint); margin:12px 0 0}

/* breakdowns */
.track-bg{fill:var(--surface-2)}
.bar-reach{fill:var(--accent); opacity:.88}
.bar-val-sub{fill:var(--fg-muted); font-size:11px; font-weight:550}
.chart-col:hover .bar{opacity:.8}

/* audience profile */
.audience-grid{display:grid; grid-template-columns:repeat(auto-fit,minmax(280px,1fr)); gap:12px; margin-top:12px}
.aud-box{padding:14px 16px; background:var(--surface-2); border-radius:10px; box-shadow:var(--shadow-border)}
.aud-pill{display:inline-block; font-size:10px; font-weight:750; text-transform:uppercase;
  letter-spacing:.06em; padding:2px 7px; border-radius:var(--radius-xs); margin-bottom:6px}
.pill-pos{background:var(--ok-bg); color:var(--ok); border:1px solid var(--ok-br)}
.pill-neg{background:var(--warn-bg); color:var(--warn); border:1px solid var(--warn-br)}
.aud-text{margin:0; font-size:13px; line-height:1.5; color:var(--fg)}

/* findings & gaps */
.finding{display:flex; gap:14px; align-items:flex-start; padding:18px 20px}
.finding + .finding{border-top:1px solid var(--border)}
.finding .dot{flex:none; width:8px; height:8px; border-radius:50%; background:var(--ok); margin-top:9px;
  box-shadow:0 0 0 3px var(--ok-bg)}
.finding p{margin:0; font-size:clamp(15px,1.8vw,16.5px); line-height:1.5; letter-spacing:-.015em; font-weight:500}
.finding .meta{margin-top:6px; font-size:12px; color:var(--fg-muted)}
.soft .dot{background:var(--mid); box-shadow:0 0 0 3px var(--mid-bg)}
.soft p{font-size:14.5px; color:var(--fg-muted)}

.gap{padding:16px 20px}
.gap + .gap{border-top:1px solid var(--border)}
.gap p{margin:0 0 10px; font-size:14px; line-height:1.5}
.gaprow{display:flex; align-items:center; gap:10px; margin-bottom:5px}
.gaprow .gl{flex:none; width:120px; font-size:11.5px; color:var(--fg-muted)}
.gaptrack{flex:1; min-width:0; height:8px; border-radius:99px; background:var(--surface-2);
  border:1px solid var(--border); overflow:hidden}
.gaptrack i{display:block; height:100%; border-radius:99px}
.gaptrack i.typ{background:var(--mid); opacity:.55}
.gaptrack i.win{background:var(--ok)}
.gapnote{font-size:11.5px; color:var(--fg-faint); margin-top:6px}

/* post explorer */
.controls-bar{display:flex; flex-wrap:wrap; gap:8px; align-items:center; padding:12px 16px;
  background:var(--surface); box-shadow:var(--shadow-border); border-radius:10px; margin-bottom:14px}
select,input[type=search],button.btn{
  font:inherit; font-size:12.5px; color:var(--fg); background:var(--surface-2);
  border:1px solid var(--border); border-radius:7px; padding:7px 11px; min-height:36px;
  transition-property:border-color,box-shadow,transform; transition-duration:150ms; transition-timing-function:cubic-bezier(0.16,1,0.3,1)}
input[type=search]{flex:1 1 180px; min-width:0}
select:focus-visible,input:focus-visible,button:focus-visible{outline:2px solid var(--accent); outline-offset:2px}
button.btn{cursor:pointer; font-weight:600; display:inline-flex; align-items:center; gap:6px; padding:7px 13px 7px 11px}
button.btn:hover{border-color:var(--border-strong); background:var(--surface-hover)}
button.btn:active{transform:scale(0.96)}
.count-pill{font-size:12px; color:var(--fg-muted); margin-left:auto; font-weight:550}

/* view switch: concentric radii (8px outer, 2px padding, 6px inner button) */
.view-switch{display:inline-flex; border:1px solid var(--border); border-radius:var(--radius-md); padding:2px; gap:2px; background:var(--surface-2)}
.vbtn{border:0; background:transparent; color:var(--fg-muted); padding:5px 11px 5px 9px; font-size:11.5px;
  font-weight:600; border-radius:var(--radius-sm); cursor:pointer; display:inline-flex; align-items:center; gap:5px;
  transition-property:color,background-color,transform; transition-duration:150ms; transition-timing-function:cubic-bezier(0.16,1,0.3,1)}
.vbtn:hover{color:var(--fg)}
.vbtn.active{background:var(--accent); color:var(--accent-fg)}
.vbtn:active{transform:scale(0.96)}

/* post table view */
.post-table-wrap{overflow-x:auto; box-shadow:var(--shadow-border); border-radius:10px; background:var(--surface)}
.post-table{width:100%; border-collapse:collapse; font-size:12.5px}
.post-table th{background:var(--surface-2); color:var(--fg-faint); font-size:11px; font-weight:700;
  text-transform:uppercase; letter-spacing:.05em; text-align:left; padding:10px 14px; border-bottom:1px solid var(--border); white-space:nowrap}
.post-table td{padding:11px 14px; border-bottom:1px solid var(--border); vertical-align:middle}
.post-table tr:last-child td{border-bottom:0}
.post-table tr:hover td{background:var(--surface-hover); cursor:pointer}
.tbl-snip{max-width:320px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; color:var(--fg); font-weight:500}
.tbl-num{font-variant-numeric:tabular-nums; font-weight:600}

/* post cards */
.posts{display:grid; gap:10px}
.post{background:var(--surface); box-shadow:var(--shadow-border); border-radius:var(--radius-lg);
  overflow:hidden; transition-property:box-shadow,border-color; transition-duration:150ms; transition-timing-function:cubic-bezier(0.16,1,0.3,1)}
.post:hover{box-shadow:var(--shadow-border-hover)}
.post-head{display:flex; gap:14px; align-items:flex-start; padding:16px 18px; cursor:pointer; width:100%;
  background:none; border:0; text-align:left; color:inherit; font:inherit;
  transition-property:background-color; transition-duration:150ms; transition-timing-function:ease-out}
.post-head:hover{background:var(--surface-hover)}
.gradebox{flex:none; width:60px; text-align:center}
.gradebox .g{font-size:24px; font-weight:800; letter-spacing:-.04em; line-height:1.05}
.gradebox .gl{font-size:9.5px; font-weight:700; letter-spacing:.06em; text-transform:uppercase; margin-top:2px}
.g-strong,.gl-strong{color:var(--ok)} .g-good,.gl-good{color:var(--good)}
.g-mixed,.gl-mixed{color:var(--warn)} .g-weak,.gl-weak{color:var(--bad)}
.post-main{min-width:0; flex:1}
.post-meta{display:flex; flex-wrap:wrap; gap:8px; font-size:11.5px; color:var(--fg-faint); margin-bottom:5px}
.post-snip{margin:0 0 8px; font-size:13.5px; line-height:1.5; color:var(--fg);
  display:-webkit-box; -webkit-line-clamp:2; -webkit-box-orient:vertical; overflow:hidden}
.metricline{font-size:12px; color:var(--fg-muted); margin-bottom:6px}
.metricline b{color:var(--fg); font-weight:650}
.caret{flex:none; color:var(--fg-faint); font-size:13px; margin-top:4px;
  transition-property:transform; transition-duration:150ms; transition-timing-function:cubic-bezier(0.16,1,0.3,1)}
.post.open .caret{transform:rotate(90deg)}
.detail{display:none; border-top:1px solid var(--border); padding:18px 20px; background:var(--surface-2)}
.post.open .detail{display:block}
.fulltext{white-space:pre-wrap; overflow-wrap:anywhere; font-size:13.5px; line-height:1.65;
  margin:0 0 18px; color:var(--fg); background:var(--surface); box-shadow:var(--shadow-border); border-radius:var(--radius-md); padding:14px 16px}
.fixes{border:1px solid var(--accent-soft); background:var(--accent-soft); border-radius:var(--radius-md);
  padding:12px 14px; margin:0 0 18px}
.fixes h3{margin-top:0; font-size:13.5px}
.fixes ol{margin:6px 0 0; padding-left:18px}
.fixes li{font-size:13px; margin-bottom:2px}
.jgroup{margin-bottom:16px}
.jgroup h4{font-size:10.5px; font-weight:700; letter-spacing:.08em; text-transform:uppercase;
  color:var(--fg-faint); margin:0 0 6px}
.jrow{display:flex; gap:8px; align-items:baseline; justify-content:space-between;
  padding:5px 0; border-bottom:1px dashed var(--border)}
.jrow:last-child{border-bottom:0}
.jname{font-size:12.5px; min-width:0; overflow-wrap:anywhere}
.jval{flex:none; text-align:right}
.jhint{display:block; font-size:11px; color:var(--fg-faint); margin-top:2px}
.empty{padding:28px 16px; text-align:center; color:var(--fg-muted); font-size:13.5px}

/* chips */
.chip{display:inline-flex; align-items:center; gap:5px; border-radius:99px; padding:2px 9px;
  font-size:11px; font-weight:600; border:1px solid var(--border); background:var(--surface-2);
  color:var(--fg-muted); white-space:nowrap; max-width:100%}
.chip .cl{overflow:hidden; text-overflow:ellipsis}
.chip-excellent{color:var(--ok); background:var(--ok-bg); border-color:var(--ok-br)}
.chip-strong{color:var(--good); background:var(--good-bg); border-color:var(--good-br)}
.chip-typical{color:var(--mid); background:var(--mid-bg); border-color:var(--mid-br)}
.chip-weak{color:var(--warn); background:var(--warn-bg); border-color:var(--warn-br)}
.chip-poor{color:var(--bad); background:var(--bad-bg); border-color:var(--bad-br)}
.chips{display:flex; flex-wrap:wrap; gap:5px}

/* prompt blueprint */
.promptbox{position:relative}
.promptbox pre{margin:0; padding:18px; white-space:pre-wrap; overflow-wrap:anywhere;
  font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace; font-size:12.5px; line-height:1.62;
  color:var(--fg); max-height:440px; overflow-y:auto}
.copybar{display:flex; gap:10px; align-items:center; padding:10px 16px; border-bottom:1px solid var(--border)}
.copybar .ok{font-size:12.5px; color:var(--ok); font-weight:600; display:inline-flex; align-items:center; gap:4px}

/* methodology & diagnostics */
details.methods{margin-top:8px}
details.methods > summary{cursor:pointer; list-style:none; padding:16px 20px; font-weight:650;
  display:flex; align-items:center; gap:8px; font-size:14.5px}
details.methods > summary::-webkit-details-marker{display:none}
details.methods > summary::before{content:"›"; color:var(--fg-faint); font-size:15px;
  transition-property:transform; transition-duration:150ms; transition-timing-function:cubic-bezier(0.16,1,0.3,1)}
details.methods[open] > summary::before{transform:rotate(90deg)}
.methods-body{padding:0 20px 22px; font-size:13.5px; color:var(--fg-muted)}
.methods-body h4{font-size:13px; color:var(--fg); margin:16px 0 6px}
.methods-body code{font-family:ui-monospace,Menlo,monospace; font-size:12px;
  background:var(--surface-2); border:1px solid var(--border); border-radius:4px; padding:1px 5px}
.methods-body ul{padding-left:18px; margin:6px 0}
.diag-table{width:100%; border-collapse:collapse; margin-top:10px; font-size:12px}
.diag-table th,.diag-table td{padding:7px 9px; text-align:left; border-bottom:1px solid var(--border)}
.diag-table th{color:var(--fg-faint); font-weight:700; text-transform:uppercase; letter-spacing:.05em; font-size:10.5px; background:var(--surface-2)}
.diag-table tr:hover td{background:var(--surface-2)}

/* tab pane toggle */
.tab-pane{display:none}
.tab-pane.active{display:block}

footer{padding:36px 0 52px; color:var(--fg-faint); font-size:12px; border-top:1px solid var(--border); margin-top:36px}

@media (max-width:768px){
  .nav-tabs{order:3; width:100%; margin:0 0 6px}
  .top-in{flex-wrap:wrap; min-height:auto; padding:6px 0}
  .gradebox{width:50px}
  .gradebox .g{font-size:20px}
  .count-pill{margin-left:0; width:100%}
}
@media (prefers-reduced-motion: reduce){*{transition:none !important; animation:none !important}}
`;
}

/* ---------------------------------------------------------------------- js */

function appJs() {
  return `
(function(){
  var D = JSON.parse(document.getElementById("payload").textContent);
  var root = document.documentElement;

  /* icons ------------------------------------------------------------- */
  var SUN_ICON = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>';
  var MOON_ICON = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>';
  var CHECK_ICON = '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>';

  /* theme ------------------------------------------------------------- */
  function setTheme(t){
    root.setAttribute("data-theme", t);
    try{ localStorage.setItem("lca-theme", t); }catch(e){}
    var b = document.getElementById("themeBtn");
    if(b){ b.innerHTML = t === "dark" ? SUN_ICON : MOON_ICON; b.setAttribute("aria-label", "Switch to " + (t === "dark" ? "light" : "dark") + " mode"); }
  }
  var stored = null;
  try{ stored = localStorage.getItem("lca-theme"); }catch(e){}
  setTheme(stored || (window.matchMedia && window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark"));
  var themeBtn = document.getElementById("themeBtn");
  if(themeBtn){
    themeBtn.addEventListener("click", function(){
      setTheme(root.getAttribute("data-theme") === "dark" ? "light" : "dark");
    });
  }

  /* tab switching ----------------------------------------------------- */
  var tabBtns = document.querySelectorAll(".tab-btn");
  var tabPanes = document.querySelectorAll(".tab-pane");

  function switchTab(targetId){
    tabBtns.forEach(function(b){
      var match = b.getAttribute("data-tab") === targetId;
      b.classList.toggle("active", match);
      b.setAttribute("aria-selected", match ? "true" : "false");
    });
    tabPanes.forEach(function(p){
      var match = p.id === targetId;
      p.classList.toggle("active", match);
    });
    try{ history.replaceState(null, "", "#" + targetId.replace("tab-", "")); }catch(e){}
  }

  tabBtns.forEach(function(b){
    b.addEventListener("click", function(){
      switchTab(b.getAttribute("data-tab"));
    });
  });

  var initialHash = window.location.hash.replace("#", "");
  if(initialHash){
    var targetPane = document.getElementById("tab-" + initialHash);
    if(targetPane) switchTab("tab-" + initialHash);
  }

  /* advanced view toggle ---------------------------------------------- */
  var advBtn = document.getElementById("advToggleBtn");
  var methodsDetails = document.getElementById("methodsDetails");
  if(advBtn && methodsDetails){
    advBtn.addEventListener("click", function(){
      switchTab("tab-methods");
      methodsDetails.open = true;
      methodsDetails.scrollIntoView({ behavior: "smooth" });
    });
  }

  /* helpers ----------------------------------------------------------- */
  function esc(s){
    return String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }
  var MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  function fmtDate(s){ var d = new Date(s); return d.getDate() + " " + MONTHS[d.getMonth()] + " " + d.getFullYear(); }
  function pct(x, dp){ return (x*100).toFixed(dp === undefined ? 1 : dp) + "%"; }
  function gradeTier(g){ return g >= 80 ? "strong" : g >= 60 ? "good" : g >= 40 ? "mixed" : "weak"; }
  function gradeWord(g){ return g >= 80 ? "Strong" : g >= 60 ? "Good" : g >= 40 ? "Mixed" : "Weak"; }
  function el(tag, cls, txt){ var e = document.createElement(tag); if(cls) e.className = cls; if(txt != null) e.textContent = txt; return e; }
  function chip(bandKey, label, title){
    var c = el("span", "chip chip-" + bandKey);
    var s = el("span", "cl", label); c.appendChild(s);
    if(title) c.title = title;
    return c;
  }

  /* post card & detail builders -------------------------------------- */
  var KEY = (D.validated || []).slice(0, 5);

  function buildDetail(p){
    var d = el("div", "detail");
    if(p.fixes && p.fixes.length){
      var fx = el("div", "fixes");
      fx.appendChild(el("h3", null, "What would most improve this post"));
      var ol = document.createElement("ol");
      p.fixes.forEach(function(dim){
        var b = p.bands && p.bands[dim];
        var li = el("li", null, (D.dimLabels[dim] || dim) + (b ? " — currently " + b[1].toLowerCase() + " for you" : ""));
        ol.appendChild(li);
      });
      fx.appendChild(ol);
      d.appendChild(fx);
    }

    d.appendChild(el("h3", null, "Full post text"));
    d.appendChild(el("div", "fulltext", p.text || "(no text)"));

    d.appendChild(el("h3", null, "Evaluated judgments"));
    (D.groups || []).forEach(function(g){
      var rows = [];
      g.dims.forEach(function(dim){
        var b = p.bands && p.bands[dim];
        if(b){
          rows.push({ dim: dim, band: b[0], label: b[1], hint: b[2] });
        } else if(p.choices && p.choices[dim]){
          rows.push({ dim: dim, choice: p.choices[dim] });
        }
      });
      if(!rows.length) return;
      var box = el("div", "jgroup");
      box.appendChild(el("h4", null, g.title));
      rows.forEach(function(r){
        var row = el("div", "jrow");
        var name = el("div", "jname", D.dimLabels[r.dim] || r.dim);
        var val = el("div", "jval");
        if(r.choice){
          val.appendChild(chip("typical", r.choice));
        } else {
          val.appendChild(chip(r.band, r.label));
          val.appendChild(el("span", "jhint", r.hint));
        }
        row.appendChild(name); row.appendChild(val);
        box.appendChild(row);
      });
      d.appendChild(box);
    });

    if(p.url){
      var a = document.createElement("a");
      a.href = p.url; a.target = "_blank"; a.rel = "noreferrer noopener";
      a.textContent = "Open post on platform \u2197";
      a.style.fontSize = "12.5px";
      d.appendChild(a);
    }
    return d;
  }

  function card(p){
    var wrap = el("article", "post");
    wrap.id = "post-" + p.id;
    var head = document.createElement("button");
    head.className = "post-head"; head.type = "button";
    head.setAttribute("aria-expanded", "false");

    var gb = el("div", "gradebox");
    if(p.grade == null){
      gb.appendChild(el("div", "g num", "–"));
      gb.appendChild(el("div", "gl", "no grade"));
    } else {
      gb.appendChild(el("div", "g num g-" + gradeTier(p.grade), String(p.grade)));
      gb.appendChild(el("div", "gl gl-" + gradeTier(p.grade), gradeWord(p.grade)));
    }
    head.appendChild(gb);

    var main = el("div", "post-main");
    var meta = el("div", "post-meta");
    meta.appendChild(el("span", "tnum", fmtDate(p.date)));
    if(p.words != null) meta.appendChild(el("span", "tnum", p.words + " words"));
    if(p.media) meta.appendChild(el("span", null, p.media));
    if(p.choices && p.choices.post_format) meta.appendChild(el("span", null, p.choices.post_format));
    if(!p.hasMetrics) meta.appendChild(el("span", null, "no numbers recorded"));
    main.appendChild(meta);
    main.appendChild(el("p", "post-snip", p.snippet + (p.text.length > 190 ? "…" : "")));

    if(p.hasMetrics && p.impressions != null){
      var m = el("div", "metricline");
      var bits = ["Seen by <b>" + p.impressions.toLocaleString() + "</b> people"];
      if(p.reach != null) bits.push("reach <b>" + pct(p.reach) + "</b>");
      if(p.conv == null) bits.push("reactions not recorded");
      else if(p.conv > 0 && p.conv < 0.001) bits.push("<b>under 0.1%</b> reacted");
      else bits.push("<b>" + pct(p.conv) + "</b> reacted");
      m.innerHTML = bits.join(" · ");
      main.appendChild(m);
    }

    var chips = el("div", "chips");
    KEY.forEach(function(dim){
      var b = p.bands && p.bands[dim];
      if(!b) return;
      chips.appendChild(chip(b[0], b[1] + " · " + (D.dimLabels[dim] || dim), b[2]));
    });
    main.appendChild(chips);
    head.appendChild(main);
    head.appendChild(el("div", "caret", "›"));
    wrap.appendChild(head);

    var built = false;
    head.addEventListener("click", function(){
      if(!built){ wrap.appendChild(buildDetail(p)); built = true; }
      var open = wrap.classList.toggle("open");
      head.setAttribute("aria-expanded", open ? "true" : "false");
    });
    return wrap;
  }

  /* post table row builder ------------------------------------------- */
  function tableRow(p){
    var tr = document.createElement("tr");
    tr.id = "tbl-row-" + p.id;
    var gHtml = p.grade != null
      ? "<span class='tbl-num g-" + gradeTier(p.grade) + "'>" + p.grade + "</span>"
      : "<span style='color:var(--fg-faint)'>–</span>";
    var reachHtml = p.reach != null ? "<span class='tbl-num'>" + pct(p.reach) + "</span>" : "–";
    var convHtml = p.conv != null ? "<span class='tbl-num'>" + pct(p.conv) + "</span>" : "–";
    var imprHtml = p.impressions != null ? "<span class='tbl-num'>" + p.impressions.toLocaleString() + "</span>" : "–";
    var fmt = (p.choices && p.choices.post_format) || p.media || "Post";
    var aiBand = (p.bands && p.bands.ai_generated_feel && p.bands.ai_generated_feel[1]) || "–";

    tr.innerHTML =
      "<td>" + gHtml + "</td>" +
      "<td class='tnum' style='white-space:nowrap'>" + fmtDate(p.date) + "</td>" +
      "<td><div class='tbl-snip'>" + esc(p.snippet) + "</div></td>" +
      "<td><span class='chip chip-typical'>" + esc(fmt) + "</span></td>" +
      "<td>" + imprHtml + "</td>" +
      "<td>" + reachHtml + "</td>" +
      "<td>" + convHtml + "</td>" +
      "<td>" + esc(aiBand) + "</td>" +
      "<td><button class='btn' style='padding:2px 7px;font-size:11px' type='button'>Expand</button></td>";

    tr.addEventListener("click", function(){
      setViewMode("cards");
      setTimeout(function(){
        var cardEl = document.getElementById("post-" + p.id);
        if(cardEl){
          cardEl.scrollIntoView({ behavior: "smooth", block: "center" });
          var btn = cardEl.querySelector(".post-head");
          if(btn && !cardEl.classList.contains("open")) btn.click();
        }
      }, 50);
    });
    return tr;
  }

  /* posts rendering & filtering -------------------------------------- */
  var list = document.getElementById("postList");
  var tableBody = document.getElementById("postTableBody");
  var tableContainer = document.getElementById("postTableWrap");
  var countEl = document.getElementById("postCount");
  var sortSel = document.getElementById("sortSel");
  var filtSel = document.getElementById("filtSel");
  var fmtSel = document.getElementById("fmtSel");
  var q = document.getElementById("searchBox");

  function setViewMode(mode){
    var cardsBtn = document.getElementById("viewCardsBtn");
    var tableBtn = document.getElementById("viewTableBtn");
    if(cardsBtn && tableBtn){
      cardsBtn.classList.toggle("active", mode === "cards");
      tableBtn.classList.toggle("active", mode === "table");
    }
    if(tableContainer) tableContainer.style.display = mode === "table" ? "block" : "none";
    if(list) list.style.display = mode === "cards" ? "grid" : "none";
  }

  var viewCardsBtn = document.getElementById("viewCardsBtn");
  var viewTableBtn = document.getElementById("viewTableBtn");
  if(viewCardsBtn) viewCardsBtn.addEventListener("click", function(){ setViewMode("cards"); });
  if(viewTableBtn) viewTableBtn.addEventListener("click", function(){ setViewMode("table"); });

  function comparator(mode){
    switch(mode){
      case "grade-asc": return function(a,b){ return (a.grade==null?999:a.grade) - (b.grade==null?999:b.grade); };
      case "new":       return function(a,b){ return b.date.localeCompare(a.date); };
      case "old":       return function(a,b){ return a.date.localeCompare(b.date); };
      case "reach":     return function(a,b){ return (b.reach||-1) - (a.reach||-1); };
      case "conv":      return function(a,b){ return (b.conv||-1) - (a.conv||-1); };
      case "impr":      return function(a,b){ return (b.impressions||-1) - (a.impressions||-1); };
      default:          return function(a,b){ return (b.grade==null?-1:b.grade) - (a.grade==null?-1:a.grade); };
    }
  }

  function render(){
    var term = (q.value || "").trim().toLowerCase();
    var formatVal = fmtSel ? fmtSel.value : "all";
    var rows = D.posts.filter(function(p){
      if(filtSel.value === "metrics" && !p.hasMetrics) return false;
      if(filtSel.value === "nometrics" && p.hasMetrics) return false;
      if(filtSel.value === "top" && !(p.grade >= 80)) return false;
      if(filtSel.value === "low" && !(p.grade != null && p.grade < 40)) return false;
      if(formatVal !== "all" && p.choices && p.choices.post_format !== formatVal) return false;
      if(term && p.text.toLowerCase().indexOf(term) === -1) return false;
      return true;
    });
    rows.sort(comparator(sortSel.value));

    // Render cards
    list.textContent = "";
    if(!rows.length){
      list.appendChild(el("div", "empty card", "No posts match that."));
    } else {
      var frag = document.createDocumentFragment();
      rows.forEach(function(p){ frag.appendChild(card(p)); });
      list.appendChild(frag);
    }

    // Render table rows
    if(tableBody){
      tableBody.textContent = "";
      var tblFrag = document.createDocumentFragment();
      rows.forEach(function(p){ tblFrag.appendChild(tableRow(p)); });
      tableBody.appendChild(tblFrag);
    }

    countEl.textContent = rows.length + " of " + D.posts.length + " posts";
  }

  sortSel.addEventListener("change", render);
  filtSel.addEventListener("change", render);
  if(fmtSel) fmtSel.addEventListener("change", render);
  q.addEventListener("input", render);
  render();

  // Hall of Fame deep links
  document.querySelectorAll(".hof-action").forEach(function(btn){
    btn.addEventListener("click", function(){
      var postId = btn.getAttribute("data-post-id");
      if(!postId) return;
      switchTab("tab-posts");
      setViewMode("cards");
      setTimeout(function(){
        var cardEl = document.getElementById("post-" + postId);
        if(cardEl){
          cardEl.scrollIntoView({ behavior: "smooth", block: "center" });
          var headBtn = cardEl.querySelector(".post-head");
          if(headBtn && !cardEl.classList.contains("open")) headBtn.click();
        }
      }, 80);
    });
  });

  /* copy prompt -------------------------------------------------------- */
  var copyBtn = document.getElementById("copyBtn");
  if(copyBtn){
    copyBtn.addEventListener("click", function(){
      var text = document.getElementById("promptText").textContent;
      var done = function(){
        var s = document.getElementById("copyState");
        s.innerHTML = CHECK_ICON + " <span>Copied to clipboard!</span>";
        setTimeout(function(){ s.textContent = ""; }, 1800);
      };
      if(navigator.clipboard && navigator.clipboard.writeText){
        navigator.clipboard.writeText(text).then(done, fallback);
      } else { fallback(); }
      function fallback(){
        var ta = document.createElement("textarea");
        ta.value = text; ta.style.position = "fixed"; ta.style.opacity = "0";
        document.body.appendChild(ta); ta.select();
        try{ document.execCommand("copy"); done(); }catch(e){}
        document.body.removeChild(ta);
      }
    });
  }
})();
`;
}

/**
 * Derived volume narrative.
 */
function volumeStory(cadence, years) {
  const total = years.reduce((a, y) => a + y.posts, 0);
  if (!cadence) {
    return { title: 'How often you published', body: `${total} posts across ${years.length || 1} year${years.length === 1 ? '' : 's'}.`, mute: -1 };
  }
  const { direction, peakYear, peakPosts, latestYear, latestPosts, otherYearAverage } = cadence;
  const muted = years.findIndex((y) => y.year === peakYear);
  const tail = 'Everything else on this page is about quality. How often you show up is the other half.';
  if (direction === 'collapsed') {
    return {
      title: 'Your posting volume fell away',
      body: `${peakPosts} posts in ${peakYear}, then around ${otherYearAverage} a year since. ${tail}`,
      mute: muted,
    };
  }
  if (direction === 'declined') {
    return {
      title: 'You are publishing less than you used to',
      body: `${peakPosts} posts in ${peakYear}, ${latestPosts} in ${latestYear}. ${tail}`,
      mute: muted,
    };
  }
  if (direction === 'rising') {
    return {
      title: 'You are publishing more than you used to',
      body: `${latestPosts} posts in ${latestYear}, your busiest year so far. ${tail}`,
      mute: -1,
    };
  }
  return {
    title: 'Your posting volume is steady',
    body: `Around ${otherYearAverage} posts a year, ${latestPosts} in ${latestYear}. ${tail}`,
    mute: -1,
  };
}

/* -------------------------------------------------------------------- html */

function html(data) {
  const c = data.corpus;
  const confirmed = data.findings.filter((f) => f.confirmed);
  const soft = data.findings.filter((f) => !f.confirmed);
  const years = c.volumeByYear ?? [];
  const followerGain = c.followerEnd != null && c.followerStart != null ? c.followerEnd - c.followerStart : null;
  const volume = volumeStory(c.cadence, years);
  const counts = data.questionCounts;
  const platform = data.platform;
  const plat = platform ? esc(platform) : 'the platform';

  const pct1 = (x) => (x == null || !Number.isFinite(x) ? null : `${(x * 100).toFixed(1)}`);
  const dateRange = data.summary.dateRange.map((d) => (d ? String(d).slice(0, 10) : '?'));

  const findingCard = (f, soften) => `
      <div class="finding${soften ? ' soft' : ''}">
        <span class="dot"></span>
        <div>
          <p>${esc(f.sentence)}</p>
          <div class="meta">About ${esc(f.outcomeShort === 'reach' ? 'how far it was distributed' : 'what people did once they saw it')}</div>
        </div>
      </div>`;

  const gapCard = (w) => {
    const span = Math.max(Math.abs(w.typical), Math.abs(w.winners), 0.001);
    const bar = (v) => Math.max(3, Math.min(100, (Math.abs(v) / span) * 100)).toFixed(1);
    return `
      <div class="gap">
        <p>${esc(w.advice)}</p>
        <div class="gaprow">
          <span class="gl">Your typical post</span>
          <div class="gaptrack"><i class="typ" style="width:${bar(w.typical)}%"></i></div>
        </div>
        <div class="gaprow">
          <span class="gl">Your best posts</span>
          <div class="gaptrack"><i class="win" style="width:${bar(w.winners)}%"></i></div>
        </div>
        <div class="gapnote">Longer bar means more ${esc(w.label)}.</div>
      </div>`;
  };

  const b = data.breakdowns;
  const hasBreakdowns = b && (b.formats?.length || b.hooks?.length || b.media?.length);

  let audienceHigherReachText = 'Posts written with authentic, grounded detail and first-hand perspective achieved higher distribution.';
  let audienceLowerReachText = 'Posts with generic announcement templates or cold direct questions saw lower distribution.';
  if (data.findings.length) {
    const aiFinding = data.findings.find((f) => f.dimension === 'ai_generated_feel');
    if (aiFinding) {
      audienceHigherReachText = 'Posts with unmistakable human voice achieved significantly higher reach in your sample.';
      audienceLowerReachText = 'Drafts with heavy AI-written feel experienced about half the reach of your most human posts.';
    }
  }
  if (b?.formats?.length) {
    const topFmt = b.formats[0];
    if (topFmt && topFmt.medianReach != null) {
      audienceHigherReachText += ` ${topFmt.label} posts (${(topFmt.medianReach * 100).toFixed(1)}% median reach) performed well in your sample.`;
    }
  }

  const formatOptions = (b?.formats || []).map((f) => `<option value="${esc(f.label)}">${esc(f.label)}</option>`).join('');
  const top = data.topPosts;

  const payload = JSON.stringify(data).replace(/[<\u2028\u2029]/g, (c) => '\\u' + c.charCodeAt(0).toString(16).padStart(4, '0'));

  return `<!doctype html>
<html lang="en" data-theme="dark">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<title>Content Review · ${plat}</title>
<meta name="description" content="What your writing actually did, in plain English.">
<link rel="icon" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%23fb923c' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolygon points='12 2 2 7 12 12 22 7 12 2'/%3E%3Cpolyline points='2 17 12 22 22 17'/%3E%3Cpolyline points='2 12 12 17 22 12'/%3E%3C/svg%3E">
<style>${css()}</style>
</head>
<body>

<header class="top">
  <div class="wrap top-in">
    <div class="brand">
      <span class="brand-icon">${ICONS.sparkle}</span>
      Content Review
      <span class="brand-badge">${plat}</span>
      <span class="meta-tag num">${esc(dateRange[0])} – ${esc(dateRange[1])}</span>
    </div>

    <nav class="nav-tabs" role="tablist" aria-label="Dashboard views">
      <button class="tab-btn active" data-tab="tab-overview" role="tab" aria-selected="true">
        ${ICONS.overview} <span>Overview</span>
      </button>
      <button class="tab-btn" data-tab="tab-formats" role="tab" aria-selected="false">
        ${ICONS.formats} <span>Formats &amp; Hooks</span>
      </button>
      <button class="tab-btn" data-tab="tab-posts" role="tab" aria-selected="false">
        ${ICONS.posts} <span>Post Explorer</span> <span class="tab-count num">${data.summary.posts}</span>
      </button>
      <button class="tab-btn" data-tab="tab-prompt" role="tab" aria-selected="false">
        ${ICONS.blueprint} <span>Writing Blueprint</span>
      </button>
      <button class="tab-btn" data-tab="tab-methods" role="tab" aria-selected="false">
        ${ICONS.methods} <span>Methodology</span>
      </button>
    </nav>

    <div class="btn-group">
      <button class="pillbtn" id="advToggleBtn" type="button" aria-pressed="false" title="Inspect statistical details and power limits">Advanced view</button>
      <button class="iconbtn" id="themeBtn" type="button" aria-label="Switch theme"></button>
    </div>
  </div>
</header>

<main class="wrap">

  <div class="hero">
    <div class="hero-tag">Writing Intelligence &amp; Performance Review</div>
    <h1>What your writing actually did</h1>
    <p class="lede">${data.summary.posts} posts, read and judged one at a time, then checked against the ones where
      ${plat} gave you real numbers. No flattery and no jargon below — just what worked, what did not, and what to do next.</p>
  </div>

  <!-- TAB 1: OVERVIEW & WINNERS --------------------------------------- -->
  <div class="tab-pane active" id="tab-overview">
    <section id="doing">
      <div class="grid kpi-grid">
        <div class="card pad stat">
          <div class="stat-k">Posts Published</div>
          <div class="stat-v num">${data.summary.posts}</div>
          <div class="stat-d">Since ${esc(dateRange[0])}. ${data.summary.withOutcomes} have verified view and reaction metrics.</div>
          ${years.length ? `<span class="stat-subpill num">${years.map((y) => `${y.posts} in '${String(y.year).slice(-2)}`).join(' · ')}</span>` : ''}
        </div>
        <div class="card pad stat">
          <div class="stat-k">Tracked Impressions</div>
          <div class="stat-v num">${data.totalTrackedImpressions ? data.totalTrackedImpressions.toLocaleString('en-US') : (data.summary.withOutcomes ? 'Recorded' : '<span class="nodata">No data</span>')}</div>
          <div class="stat-d">Total verified views across ${data.summary.withOutcomes} posts with export numbers.</div>
        </div>
        <div class="card pad stat">
          <div class="stat-k">Typical Reach</div>
          <div class="stat-v num">${pct1(c.medianReachRate) ?? '<span class="nodata">No data</span>'}${pct1(c.medianReachRate) == null ? '' : '<span class="unit">%</span>'}</div>
          <div class="stat-d">${esc(data.outcomes.reach_rate.explainer)}</div>
          ${top?.topReach?.reach ? `<span class="stat-subpill num">Peak: ${(top.topReach.reach * 100).toFixed(1)}%</span>` : ''}
        </div>
        <div class="card pad stat">
          <div class="stat-k">Typical Engagement</div>
          <div class="stat-v num">${pct1(c.medianConversionRate) ?? '<span class="nodata">No data</span>'}${pct1(c.medianConversionRate) == null ? '' : '<span class="unit">%</span>'}</div>
          <div class="stat-d">${esc(data.outcomes.conversion_rate.explainer)}</div>
          ${top?.topEngage?.conv ? `<span class="stat-subpill num">Peak: ${(top.topEngage.conv * 100).toFixed(1)}%</span>` : ''}
        </div>
        <div class="card pad stat">
          <div class="stat-k">Audience Size</div>
          <div class="stat-v num">${(c.followerEnd ?? 0).toLocaleString('en-US')}</div>
          <div class="stat-d">${followerGain != null ? `${followerGain > 0 ? 'Up' : 'Down'} ${Math.abs(followerGain).toLocaleString('en-US')}` : 'Change unknown'} since your first post here.</div>
        </div>
      </div>

      <!-- Key Insights Banner (Dynamic from validated findings) -->
      ${(data.findings && data.findings.length > 0) ? `
      <div class="takeaways-banner" style="margin-top:16px">
        <div class="takeaways-head">${ICONS.sparkle} Key Signals &amp; Performance Levers</div>
        <div class="takeaways-grid">
          ${data.findings.slice(0, 3).map((f, i) => {
            const icon = i === 0 ? ICONS.formatLayer : i === 1 ? ICONS.shieldAlert : ICONS.messageCircle;
            const heading = f.confirmed
              ? `Key Driver: ${esc(f.dimensionLabel || f.dimension)}`
              : `Signal to Watch: ${esc(f.dimensionLabel || f.dimension)}`;
            return `
            <div class="takeaway-item">
              <div class="takeaway-icon">${icon}</div>
              <div>
                <h4>${heading}</h4>
                <p>${esc(f.sentence)}</p>
              </div>
            </div>`;
          }).join('')}
        </div>
      </div>` : ''}

      <!-- Hall of Fame Winning Posts -->
      ${top?.topReach ? `
      <div class="hof-title">
        <h3>Top Outliers &amp; High-Performing Posts</h3>
        <span class="hof-sub">Click any post to inspect its full text and judgments</span>
      </div>
      <div class="grid three-col">
        <div class="hof-card">
          <div>
            <span class="hof-badge hof-gold">${ICONS.medal} Top Reach Rate</span>
            <div class="hof-stats">
              <span class="hof-stat-main num">${(top.topReach.reach * 100).toFixed(1)}%</span>
              <span class="hof-stat-sub num">${top.topReach.impressions?.toLocaleString('en-US')} views · ${esc(top.topReach.choices?.post_format || top.topReach.media || 'Post')}</span>
            </div>
            <p class="hof-snip">"${esc(top.topReach.snippet)}…"</p>
          </div>
          <button class="hof-action" data-post-id="${esc(top.topReach.id)}" type="button">Inspect Post Judgments ${ICONS.arrowRight}</button>
        </div>

        ${top.topEngage ? `
        <div class="hof-card">
          <div>
            <span class="hof-badge hof-emerald">${ICONS.chat} Top Engagement Rate</span>
            <div class="hof-stats">
              <span class="hof-stat-main num">${(top.topEngage.conv * 100).toFixed(1)}%</span>
              <span class="hof-stat-sub num">${top.topEngage.impressions?.toLocaleString('en-US')} views · ${esc(top.topEngage.choices?.post_format || top.topEngage.media || 'Post')}</span>
            </div>
            <p class="hof-snip">"${esc(top.topEngage.snippet)}…"</p>
          </div>
          <button class="hof-action" data-post-id="${esc(top.topEngage.id)}" type="button">Inspect Post Judgments ${ICONS.arrowRight}</button>
        </div>` : ''}

        ${top.topImpressions ? `
        <div class="hof-card">
          <div>
            <span class="hof-badge hof-amber">${ICONS.eye} Top Total Impressions</span>
            <div class="hof-stats">
              <span class="hof-stat-main num">${top.topImpressions.impressions?.toLocaleString('en-US')}</span>
              <span class="hof-stat-sub num">${top.topImpressions.reach ? `${(top.topImpressions.reach * 100).toFixed(1)}% reach` : ''} · ${esc(top.topImpressions.choices?.post_format || 'Post')}</span>
            </div>
            <p class="hof-snip">"${esc(top.topImpressions.snippet)}…"</p>
          </div>
          <button class="hof-action" data-post-id="${esc(top.topImpressions.id)}" type="button">Inspect Post Judgments ${ICONS.arrowRight}</button>
        </div>` : ''}
      </div>` : ''}

      <!-- Cadence & Follower Charts -->
      <div class="grid two-col" style="margin-top:20px">
        <div class="card pad chart-box">
          <h3>${esc(volume.title)}</h3>
          <p class="sub">${esc(volume.body)}</p>
          ${volumeChart(years, volume.mute)}
          <p class="note">Posts published per year.</p>
        </div>
        <div class="card pad chart-box">
          <h3>${followerGain != null && followerGain > 0 ? 'Your audience kept growing' : 'Your audience over time'}</h3>
          <p class="sub">From ${(c.followerStart ?? 0).toLocaleString('en-US')} to
            ${(c.followerEnd ?? 0).toLocaleString('en-US')} over the same period.</p>
          ${followerChart(c.followers)}
          <p class="note">Followers at the time of each post.</p>
        </div>
      </div>
    </section>

    <!-- Findings Section -->
    <section id="working" style="padding-top:20px">
      <div class="hof-title" style="margin-top:0">
        <h3>What's working for you</h3>
        <span class="hof-sub">Derived from comparing your posts against each other</span>
      </div>

      <div class="card" style="margin-bottom:16px">
        ${confirmed.length ? confirmed.map((f) => findingCard(f, false)).join('') : '<div class="empty">Nothing held up firmly enough to state as a result.</div>'}
      </div>

      ${soft.length ? `
      <h4 style="margin:16px 0 8px;font-size:14px;color:var(--fg-muted)">Worth watching (Hunches to test)</h4>
      <div class="card" style="margin-bottom:16px">
        ${soft.map((f) => findingCard(f, true)).join('')}
      </div>` : ''}

      <div class="card pad" style="margin-top:14px">
        <h4 style="margin:0 0 8px;font-size:14px">Observed audience response profile</h4>
        <div class="audience-grid">
          <div class="aud-box">
            <span class="aud-pill pill-pos">High Response</span>
            <p class="aud-text">${esc(audienceHigherReachText)}</p>
          </div>
          <div class="aud-box">
            <span class="aud-pill pill-neg">Lower Response</span>
            <p class="aud-text">${esc(audienceLowerReachText)}</p>
          </div>
        </div>
        <p class="note">These describe observational medians across your ${data.summary.withOutcomes} posts with numbers. Because slice sizes are small, treat these as patterns to test rather than proven rules.</p>
      </div>

      <div style="margin-top:20px">
        <h4 style="margin:0 0 8px;font-size:14px">The gap between your best posts and your typical post</h4>
        <div class="card">
          ${data.weakSpots.length ? data.weakSpots.map(gapCard).join('') : '<div class="empty">Not enough posts with numbers to compare.</div>'}
        </div>
      </div>
    </section>
  </div>

  <!-- TAB 2: FORMATS & HOOKS ------------------------------------------ -->
  <div class="tab-pane" id="tab-formats">
    <section id="formats-detail">
      <div class="hof-title" style="margin-top:0">
        <h3>Post Formats &amp; Hook Archetypes</h3>
        <span class="hof-sub">Median reach and engagement rates across content structures. Sample sizes in parentheses.</span>
      </div>

      ${hasBreakdowns ? `
      <div class="grid two-col">
        <div class="card pad">
          <h4 style="margin:0 0 10px;font-size:13.5px;font-weight:700">Post Formats Breakdown</h4>
          ${b.formats?.length ? breakdownSvg(b.formats, 'Post formats') : '<div class="empty">Not enough format data</div>'}
          <p class="note">Comparing listicles, teardowns, announcements, narratives, and opinions.</p>
        </div>
        <div class="card pad">
          <h4 style="margin:0 0 10px;font-size:13.5px;font-weight:700">Opening Hook Archetypes</h4>
          ${b.hooks?.length ? breakdownSvg(b.hooks, 'Opening hook archetypes') : '<div class="empty">Not enough hook data</div>'}
          <p class="note">Comparing personal stories, announcements, contrarian claims, and questions.</p>
        </div>
      </div>

      <div class="grid two-col" style="margin-top:14px">
        <div class="card pad">
          <h4 style="margin:0 0 10px;font-size:13.5px;font-weight:700">Media Types Impact</h4>
          ${b.media?.length ? breakdownSvg(b.media, 'Media types') : '<div class="empty">Not enough media data</div>'}
          <p class="note">Comparing reach and engagement across media attachments in your sample.</p>
        </div>
        <div class="card pad">
          <h4 style="margin:0 0 10px;font-size:13.5px;font-weight:700">Emotional Register &amp; Tone</h4>
          ${b.tones?.length ? breakdownSvg(b.tones, 'Emotional register') : '<div class="empty">Not enough tone data</div>'}
          <p class="note">Comparing reach and engagement across emotional tone ratings in your sample.</p>
        </div>
      </div>` : '<div class="card empty">Not enough posts with numbers to compute format breakdowns.</div>'}
    </section>
  </div>

  <!-- TAB 3: POST EXPLORER --------------------------------------------- -->
  <div class="tab-pane" id="tab-posts">
    <section id="posts">
      <div class="hof-title" style="margin-top:0">
        <h3>Your Posts, Graded &amp; Filterable</h3>
        <span class="hof-sub">Tap any post to inspect the full text and every single model judgment.</span>
      </div>

      <div class="controls-bar">
        <label class="sr-only" for="sortSel">Sort posts</label>
        <select id="sortSel" aria-label="Sort posts">
          <option value="grade-desc">Best graded first</option>
          <option value="reach">Most reach first</option>
          <option value="conv">Most engagement first</option>
          <option value="impr">Most impressions first</option>
          <option value="new">Newest first</option>
          <option value="old">Oldest first</option>
          <option value="grade-asc">Worst graded first</option>
        </select>

        <label class="sr-only" for="filtSel">Filter posts</label>
        <select id="filtSel" aria-label="Filter posts">
          <option value="all">All posts</option>
          <option value="metrics">Only posts with real numbers</option>
          <option value="nometrics">Posts without metrics</option>
          <option value="top">Strong posts (80+)</option>
          <option value="low">Weak posts (under 40)</option>
        </select>

        <label class="sr-only" for="fmtSel">Filter by format</label>
        <select id="fmtSel" aria-label="Filter by format">
          <option value="all">All formats</option>
          ${formatOptions}
        </select>

        <input type="search" id="searchBox" placeholder="Search post text…" aria-label="Search post text">

        <div class="view-switch">
          <button type="button" class="vbtn active" id="viewCardsBtn" aria-pressed="true">${ICONS.cards} Cards</button>
          <button type="button" class="vbtn" id="viewTableBtn" aria-pressed="false">${ICONS.table} Table</button>
        </div>

        <span class="count-pill num" id="postCount"></span>
      </div>

      <!-- Table View -->
      <div class="post-table-wrap" id="postTableWrap" style="display:none;margin-bottom:14px">
        <table class="post-table">
          <thead>
            <tr>
              <th>Grade</th>
              <th>Date</th>
              <th>Snippet</th>
              <th>Format</th>
              <th>Views</th>
              <th>Reach</th>
              <th>Engagement</th>
              <th>AI Feel</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody id="postTableBody"></tbody>
        </table>
      </div>

      <!-- Cards View -->
      <div class="posts" id="postList"></div>
    </section>
  </div>

  <!-- TAB 4: WRITING BLUEPRINT ----------------------------------------- -->
  <div class="tab-pane" id="tab-prompt">
    <section id="prompt">
      <div class="hof-title" style="margin-top:0">
        <h3>Your Pre-Flight Writing Blueprint</h3>
        <span class="hof-sub">Paste this prompt into Claude, ChatGPT, or Cursor along with your draft before publishing.</span>
      </div>

      <div class="card promptbox">
        <div class="copybar">
          <button class="btn" id="copyBtn" type="button">${ICONS.copy} <span>Copy to clipboard</span></button>
          <span class="ok" id="copyState" role="status" aria-live="polite"></span>
          <span style="font-size:11.5px;color:var(--fg-faint);margin-left:auto">scroll inside the box for full prompt</span>
        </div>
        <pre id="promptText">${esc(data.writingPrompt ?? 'No prompt could be generated.')}</pre>
      </div>
    </section>
  </div>

  <!-- TAB 5: METHODOLOGY & LAB ---------------------------------------- -->
  <div class="tab-pane" id="tab-methods">
    <section id="methods">
      <div class="card">
        <details class="methods" id="methodsDetails" open>
          <summary>Statistical detail &amp; verification diagnostics</summary>
          <div class="methods-body">
            <p>Everything above avoids technical jargon on purpose. This section does not — it is here so the
              numbers can be audited, verified, and checked rather than trusted.</p>

            <h4>What was measured</h4>
            <p>Each of the ${data.summary.posts} posts was rated against the ${esc(data.pack.id)} rubric pack
              (v${esc(data.pack.version)}), ${counts.total} questions in all, each answered independently several
              times and averaged. ${counts.primary} ${counts.primary === 1 ? 'question was' : 'questions were'}
              pre-registered as primary hypotheses; the remaining ${counts.exploratory} are exploratory and are never
              promoted to a result.</p>

            <h4>Bands</h4>
            <p>A raw rubric level is meaningless on its own, so every dimension is banded against the quintiles of this
              author's own distribution: bottom 20% is <em>Poor</em>, top 20% is <em>Excellent</em>. Each question
              carries a declared direction of merit, so <code>ai_generated_feel</code> bands in reverse to
              <code>hook_strength</code>, and dimensions marked <code>neutral</code> (technicality, voice confidence,
              vulnerability, provokes disagreement) always band as <em>Typical</em> rather than being scored as good
              or bad.</p>

            <h4>Statistical detail</h4>
            <p>Each dimension was tested against two outcomes — reach rate (impressions / followers at post time) and
              conversion rate (engagements / impressions) — using a partial Spearman rank correlation controlling for
              post date, with p-values from a permutation test on the date-residualised ranks, and a 0.05 threshold.
              Only dimensions clearing that threshold enter the post grade, weighted by |rho|. Findings from
              pre-registered primary questions are shown as results; exploratory ones appear as "worth watching".</p>
            <ul>
              <li>Reach: ${esc(data.power.reach_rate.headline)}</li>
              <li>Engagement: ${esc(data.power.conversion_rate.headline)}</li>
            </ul>

            <h4>Findings, with the numbers behind them</h4>
            <ul>
              ${data.findings
                .map(
                  (f) =>
                    `<li><code>${esc(f.dimension)}</code> vs <code>${esc(f.outcome)}</code> — ` +
                    `${f.confirmed ? 'primary' : 'exploratory'}, partial rho ${f._stats.partialRho.toFixed(3)}, ` +
                    `p = ${f._stats.p.toFixed(4)}, n = ${f._stats.n}; top third median ` +
                    `${(f.comparison.highMedian * 100).toFixed(1)}% vs bottom third ` +
                    `${(f.comparison.lowMedian * 100).toFixed(1)}%.</li>`,
                )
                .join('')}
            </ul>

            <h4>Detailed Diagnostic Table</h4>
            <table class="diag-table">
              <thead>
                <tr>
                  <th>Dimension</th>
                  <th>Outcome</th>
                  <th>Tier</th>
                  <th>Partial Rho</th>
                  <th>Permutation P</th>
                  <th>Sample (n)</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                ${data.findings
                  .map(
                    (f) =>
                      `<tr>` +
                      `<td><code>${esc(f.dimension)}</code></td>` +
                      `<td>${esc(f.outcomeShort || f.outcome)}</td>` +
                      `<td>${esc(f.tier)}</td>` +
                      `<td class="num">${f._stats.partialRho.toFixed(3)}</td>` +
                      `<td class="num">${f._stats.p.toFixed(4)}</td>` +
                      `<td class="num">${f._stats.n}</td>` +
                      `<td>${f.confirmed ? '<span style="color:var(--ok)">Confirmed</span>' : '<span style="color:var(--warn)">Exploratory</span>'}</td>` +
                      `</tr>`,
                  )
                  .join('')}
              </tbody>
            </table>

            <h4>Caveats worth taking seriously</h4>
            <ul>
              <li>Only ${data.summary.withOutcomes} of ${data.summary.posts} posts have outcome data, and they are not
                a random sample — they are the recent ones. Anything before ${esc(String(years[1]?.year ?? ''))} is
                graded but never contributed to a finding.</li>
              <li>With this many posts and this many tests, roughly
                ${data.power.reach_rate.expectedFalsePositives.toFixed(1)} of
                ${data.power.reach_rate.nTests} tests will clear the threshold by chance alone. That is why exploratory
                results are separated out rather than mixed in.</li>
              <li>Rubric ratings come from a language model reading the text. They are consistent, not objective.</li>
              <li>Everything here is a correlation within one person's posting history. It cannot prove that changing
                a dimension would change the outcome.</li>
            </ul>
          </div>
        </details>
      </div>
    </section>
  </div>

  <footer>
    Generated ${esc(String(data.generatedAt).slice(0, 10))} from your own export. Private — everything on this page
    stays in this file.
  </footer>
</main>

<script id="payload" type="application/json">${payload}</script>
<script>${appJs()}</script>
</body>
</html>
`;
}

/**
 * Build the dashboard as a single HTML string.
 */
export function buildDashboard(report, opts = {}) {
  if (!report || !Array.isArray(report.posts)) {
    throw new Error('buildDashboard needs the object buildReport() returned');
  }
  if (!report.corpus) {
    throw new Error(
      'this report.json predates the dashboard and has no "corpus" field. Re-run "jev-writer analyze".',
    );
  }
  return html(buildData(report, opts));
}
