/**
 * Build the dashboard: one self-contained HTML file with inline CSS, inline JS
 * and the data embedded. No CDN, no fetch, no build step. It opens over
 * file:// on a laptop with no network.
 *
 * The presentation contract, which is the whole point of this file:
 *   - no statistics vocabulary anywhere except the collapsed methods section;
 *   - every rubric judgment appears as a coloured band, never as a raw number;
 *   - bands arrive direction-aware from the report and are never recomputed
 *     here, so a low score on a dimension where low is good still paints green;
 *   - charts only where a chart genuinely says something.
 *
 * This module does no I/O. It takes the object `buildReport` returned and gives
 * back a string. The CLI owns reading and writing files.
 */

import { DIMENSION_LABELS } from './report.mjs';

const labelFor = (d) => DIMENSION_LABELS[d] ?? d.replace(/_/g, ' ');

/**
 * Judgments are grouped into families for the expanded post view. A pack may
 * declare its own `groups`; anything the pack does not place falls into a final
 * catch-all so a new pack renders sensibly on day one instead of silently
 * dropping half its questions.
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
 * Text arriving from a CSV export often carries stray wrapping quotes and runs
 * of blank lines. Rendering that raw makes every post look broken.
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
 * Question counts for the methods appendix. Derived from the pack so a pack with
 * a different number of questions describes itself correctly; falls back to
 * counting what actually reached the report when no pack is supplied.
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
 * Reshape the report into the payload the page embeds. Nothing here touches the
 * filesystem: `report` is exactly what buildReport returned, and `ratings` is
 * the rows from ratings.jsonl, needed only because Choice answers are
 * descriptive labels rather than bands and so are dropped from the report model.
 */
function buildData(report, { ratings = [], pack = null, platform = null } = {}) {
  const choices = new Map();
  for (const row of ratings) {
    choices.set(row.id, { ...(choices.get(row.id) ?? {}), ...choiceAnswers(row.ratings) });
  }
  const validated = report.validated.map((v) => v.dimension);

  // buildReport spreads the whole corpus item into report.posts, so post text
  // and raw metrics are already on `p`. The private version of this file joined
  // a second posts.jsonl here; that join was redundant and is gone.
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
      bands: Object.fromEntries(Object.entries(p.bands).map(([k, b]) => [k, [b.band, b.label, b.hint]])),
      choices: choices.get(p.id) ?? {},
      fixes: p.fixes ?? [],
    };
  });

  const allDims = [...new Set(report.posts.flatMap((p) => Object.keys(p.bands ?? {})))];
  const groups = groupsFor(pack, allDims);
  const dimLabels = {};
  for (const d of allDims) dimLabels[d] = labelFor(d);
  for (const g of groups) for (const d of g.dims) dimLabels[d] = labelFor(d);

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
    posts: slim,
  };
}

/* ------------------------------------------------------------------ charts */

const esc = (s) =>
  String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** Posting volume by year. `muteIndex` dims the peak year when the story is a decline. */
function volumeChart(rows, muteIndex = -1) {
  const W = 640, H = 240, padL = 8, padR = 8, padT = 28, padB = 34;
  const max = Math.max(...rows.map((r) => r.posts), 1);
  const plotW = W - padL - padR, plotH = H - padT - padB;
  const slot = plotW / rows.length;
  const bw = Math.min(96, slot * 0.56);
  let bars = '';
  rows.forEach((r, i) => {
    const h = Math.max(2, (r.posts / max) * plotH);
    const x = padL + slot * i + (slot - bw) / 2;
    const y = padT + plotH - h;
    const hi = i === muteIndex;
    bars +=
      `<rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${bw.toFixed(1)}" height="${h.toFixed(1)}" rx="6" ` +
      `class="${hi ? 'bar bar-muted' : 'bar'}"/>` +
      `<text x="${(x + bw / 2).toFixed(1)}" y="${(y - 9).toFixed(1)}" class="bar-val" text-anchor="middle">${r.posts}</text>` +
      `<text x="${(x + bw / 2).toFixed(1)}" y="${(H - 12).toFixed(1)}" class="bar-lab" text-anchor="middle">${esc(r.year)}</text>`;
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
  const W = 640, H = 220, padL = 46, padR = 12, padT = 18, padB = 30;
  if (points.length < 2) return '';
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
    ticks += `<text x="${px(new Date(first.date).getTime()).toFixed(1)}" y="${H - 9}" class="bar-lab" text-anchor="middle">${esc(y)}</text>`;
  }
  const fmt = (v) => (v >= 1000 ? `${(v / 1000).toFixed(1)}k` : String(v));
  return (
    `<svg viewBox="0 0 ${W} ${H}" class="chart" role="img" aria-label="Follower count over time, from ${fmt(ys[0])} to ${fmt(ys[ys.length - 1])}">` +
    `<line x1="${padL}" y1="${padT + 0.5}" x2="${W - padR}" y2="${padT + 0.5}" class="gridline"/>` +
    `<line x1="${padL}" y1="${(padT + plotH + 0.5).toFixed(1)}" x2="${W - padR}" y2="${(padT + plotH + 0.5).toFixed(1)}" class="axis"/>` +
    `<text x="${padL - 8}" y="${padT + 5}" class="bar-lab" text-anchor="end">${fmt(y1)}</text>` +
    `<text x="${padL - 8}" y="${padT + plotH}" class="bar-lab" text-anchor="end">${fmt(y0)}</text>` +
    `<path d="${area}" class="area"/><path d="${d}" class="line"/>` +
    ticks +
    `</svg>`
  );
}

/* -------------------------------------------------------------------- html */

function css() {
  return `
:root{
  --bg:#f7f7f8; --surface:#ffffff; --surface-2:#fbfbfc; --border:#e4e4e7; --border-strong:#d4d4d8;
  --fg:#18181b; --fg-muted:#6b7280; --fg-faint:#9ca3af;
  --accent:#4f46e5; --accent-fg:#ffffff; --accent-soft:rgba(79,70,229,.10);
  --ok:#15803d; --ok-bg:rgba(22,163,74,.12); --ok-br:rgba(22,163,74,.30);
  --good:#0f766e; --good-bg:rgba(13,148,136,.12); --good-br:rgba(13,148,136,.30);
  --mid:#6b7280; --mid-bg:rgba(107,114,128,.12); --mid-br:rgba(107,114,128,.28);
  --warn:#b45309; --warn-bg:rgba(217,119,6,.14); --warn-br:rgba(217,119,6,.32);
  --bad:#b91c1c; --bad-bg:rgba(220,38,38,.12); --bad-br:rgba(220,38,38,.30);
  --shadow:0 1px 2px rgba(16,18,27,.05),0 8px 24px -16px rgba(16,18,27,.24);
  --radius:14px;
}
@media (prefers-color-scheme: dark){
  :root:not([data-theme="light"]){
    --bg:#09090b; --surface:#131316; --surface-2:#1a1a1f; --border:#26262b; --border-strong:#35353c;
    --fg:#f4f4f5; --fg-muted:#a1a1aa; --fg-faint:#71717a;
    --accent:#818cf8; --accent-fg:#0b0b10; --accent-soft:rgba(129,140,248,.14);
    --ok:#4ade80; --ok-bg:rgba(74,222,128,.13); --ok-br:rgba(74,222,128,.28);
    --good:#2dd4bf; --good-bg:rgba(45,212,191,.13); --good-br:rgba(45,212,191,.28);
    --mid:#a1a1aa; --mid-bg:rgba(161,161,170,.13); --mid-br:rgba(161,161,170,.26);
    --warn:#fbbf24; --warn-bg:rgba(251,191,36,.14); --warn-br:rgba(251,191,36,.30);
    --bad:#f87171; --bad-bg:rgba(248,113,113,.14); --bad-br:rgba(248,113,113,.30);
    --shadow:0 1px 2px rgba(0,0,0,.5),0 12px 32px -20px rgba(0,0,0,.9);
  }
}
:root[data-theme="dark"]{
  --bg:#09090b; --surface:#131316; --surface-2:#1a1a1f; --border:#26262b; --border-strong:#35353c;
  --fg:#f4f4f5; --fg-muted:#a1a1aa; --fg-faint:#71717a;
  --accent:#818cf8; --accent-fg:#0b0b10; --accent-soft:rgba(129,140,248,.14);
  --ok:#4ade80; --ok-bg:rgba(74,222,128,.13); --ok-br:rgba(74,222,128,.28);
  --good:#2dd4bf; --good-bg:rgba(45,212,191,.13); --good-br:rgba(45,212,191,.28);
  --mid:#a1a1aa; --mid-bg:rgba(161,161,170,.13); --mid-br:rgba(161,161,170,.26);
  --warn:#fbbf24; --warn-bg:rgba(251,191,36,.14); --warn-br:rgba(251,191,36,.30);
  --bad:#f87171; --bad-bg:rgba(248,113,113,.14); --bad-br:rgba(248,113,113,.30);
  --shadow:0 1px 2px rgba(0,0,0,.5),0 12px 32px -20px rgba(0,0,0,.9);
}

*,*::before,*::after{box-sizing:border-box}
html{-webkit-text-size-adjust:100%}
body{
  margin:0; background:var(--bg); color:var(--fg);
  font-family:ui-sans-serif,-apple-system,BlinkMacSystemFont,"Segoe UI",Inter,Roboto,Helvetica,Arial,sans-serif;
  font-size:16px; line-height:1.6; -webkit-font-smoothing:antialiased; overflow-x:hidden;
}
.num,.tnum{font-variant-numeric:tabular-nums; font-feature-settings:"tnum" 1}
.wrap{max-width:1080px; margin:0 auto; padding:0 16px}
a{color:var(--accent)}

/* header */
.top{position:sticky; top:0; z-index:20; background:color-mix(in srgb,var(--bg) 88%,transparent);
  backdrop-filter:saturate(1.4) blur(10px); border-bottom:1px solid var(--border)}
.top-in{display:flex; align-items:center; gap:12px; min-height:58px}
.brand{font-weight:650; letter-spacing:-.01em; margin-right:auto; font-size:15px}
.brand small{display:block; font-weight:450; color:var(--fg-faint); font-size:12px; letter-spacing:0}
.tabs{display:flex; gap:2px; overflow-x:auto; scrollbar-width:none}
.tabs::-webkit-scrollbar{display:none}
.tabs a{white-space:nowrap; font-size:13px; color:var(--fg-muted); text-decoration:none;
  padding:6px 10px; border-radius:8px}
.tabs a:hover{background:var(--surface-2); color:var(--fg)}
.iconbtn{flex:none; border:1px solid var(--border); background:var(--surface); color:var(--fg-muted);
  width:34px; height:34px; border-radius:9px; cursor:pointer; font-size:15px; line-height:1}
.iconbtn:hover{color:var(--fg); border-color:var(--border-strong)}

/* hero */
.hero{padding:44px 0 8px}
h1{font-size:clamp(28px,6vw,40px); line-height:1.12; letter-spacing:-.025em; margin:0 0 10px; font-weight:680}
.lede{font-size:clamp(16px,2.4vw,18px); color:var(--fg-muted); max-width:62ch; margin:0}

section{padding:36px 0 8px; scroll-margin-top:70px}
h2{font-size:clamp(20px,3.4vw,26px); letter-spacing:-.02em; margin:0 0 6px; font-weight:660}
h3{font-size:15px; letter-spacing:-.01em; margin:0 0 10px; font-weight:620}
.sub{color:var(--fg-muted); margin:0 0 20px; max-width:66ch; font-size:15px}
.eyebrow{font-size:11px; font-weight:650; letter-spacing:.09em; text-transform:uppercase;
  color:var(--fg-faint); margin:0 0 8px}

.card{background:var(--surface); border:1px solid var(--border); border-radius:var(--radius);
  box-shadow:var(--shadow)}
.pad{padding:20px}
.grid{display:grid; gap:14px}
.stats{grid-template-columns:repeat(auto-fit,minmax(min(210px,100%),1fr))}
.two{grid-template-columns:repeat(auto-fit,minmax(min(320px,100%),1fr))}

.stat .k{font-size:12px; font-weight:600; color:var(--fg-muted); letter-spacing:.01em}
.stat .v{font-size:clamp(28px,5vw,34px); font-weight:680; letter-spacing:-.03em; line-height:1.15; margin:6px 0 6px}
.stat .d{font-size:13px; color:var(--fg-muted); line-height:1.5}
.stat .v .nodata{font-size:.5em;font-weight:500;opacity:.55;letter-spacing:0}
.unit{font-size:16px; font-weight:560; color:var(--fg-muted); margin-left:2px}

/* charts */
.chart{width:100%; height:auto; display:block; overflow:visible}
.bar{fill:var(--accent)}
.bar-muted{fill:var(--mid); opacity:.55}
.bar-val{fill:var(--fg); font-size:13px; font-weight:620; font-variant-numeric:tabular-nums}
.bar-lab{fill:var(--fg-faint); font-size:11.5px}
.axis{stroke:var(--border-strong)}
.gridline{stroke:var(--border); stroke-dasharray:3 4}
.line{fill:none; stroke:var(--accent); stroke-width:2.25; stroke-linejoin:round; stroke-linecap:round}
.area{fill:var(--accent-soft); stroke:none}
.note{font-size:13px; color:var(--fg-muted); margin:14px 0 0}

/* findings */
.finding{display:flex; gap:14px; align-items:flex-start; padding:20px}
.finding + .finding{border-top:1px solid var(--border)}
.finding .dot{flex:none; width:9px; height:9px; border-radius:50%; background:var(--ok); margin-top:11px;
  box-shadow:0 0 0 4px var(--ok-bg)}
.finding p{margin:0; font-size:clamp(16px,2.3vw,19px); line-height:1.5; letter-spacing:-.012em}
.finding .meta{margin-top:8px; font-size:13px; color:var(--fg-muted)}
.soft .dot{background:var(--mid); box-shadow:0 0 0 4px var(--mid-bg)}
.soft p{font-size:15px; color:var(--fg-muted)}

.gap{padding:18px 20px}
.gap + .gap{border-top:1px solid var(--border)}
.gap p{margin:0 0 12px; font-size:15.5px; line-height:1.5}
.gaprow{display:flex; align-items:center; gap:10px; margin-bottom:6px}
.gaprow .gl{flex:none; width:118px; font-size:12px; color:var(--fg-muted)}
.gaptrack{flex:1; min-width:0; height:9px; border-radius:99px; background:var(--surface-2);
  border:1px solid var(--border); overflow:hidden}
.gaptrack i{display:block; height:100%; border-radius:99px}
.gaptrack i.typ{background:var(--mid); opacity:.55}
.gaptrack i.win{background:var(--ok)}
.gapnote{font-size:12px; color:var(--fg-faint); margin-top:8px}
@media (max-width:560px){ .gaprow{flex-wrap:wrap; gap:4px} .gaprow .gl{width:auto} .gaptrack{flex:1 1 100%} }

/* chips */
.chip{display:inline-flex; align-items:center; gap:6px; border-radius:99px; padding:3px 10px;
  font-size:12px; font-weight:560; border:1px solid var(--border); background:var(--surface-2);
  color:var(--fg-muted); white-space:nowrap; max-width:100%}
.chip .cl{overflow:hidden; text-overflow:ellipsis}
.chip-excellent{color:var(--ok); background:var(--ok-bg); border-color:var(--ok-br)}
.chip-strong{color:var(--good); background:var(--good-bg); border-color:var(--good-br)}
.chip-typical{color:var(--mid); background:var(--mid-bg); border-color:var(--mid-br)}
.chip-weak{color:var(--warn); background:var(--warn-bg); border-color:var(--warn-br)}
.chip-poor{color:var(--bad); background:var(--bad-bg); border-color:var(--bad-br)}
.chips{display:flex; flex-wrap:wrap; gap:6px}

/* controls */
.controls{display:flex; flex-wrap:wrap; gap:8px; align-items:center; margin-bottom:16px}
select,input[type=search],button.btn{
  font:inherit; font-size:13.5px; color:var(--fg); background:var(--surface);
  border:1px solid var(--border); border-radius:9px; padding:7px 11px}
input[type=search]{flex:1 1 180px; min-width:0}
select:focus-visible,input:focus-visible,button:focus-visible,summary:focus-visible,.post:focus-visible{
  outline:2px solid var(--accent); outline-offset:2px}
button.btn{cursor:pointer; font-weight:560}
button.btn:hover{border-color:var(--border-strong)}
.count{font-size:13px; color:var(--fg-faint); margin-left:auto}

/* posts */
.posts{display:grid; gap:12px}
.post{background:var(--surface); border:1px solid var(--border); border-radius:var(--radius);
  box-shadow:var(--shadow); overflow:hidden}
.post-head{display:flex; gap:16px; align-items:flex-start; padding:16px; cursor:pointer; width:100%;
  background:none; border:0; text-align:left; color:inherit; font:inherit}
.post-head:hover{background:var(--surface-2)}
.gradebox{flex:none; width:62px; text-align:center}
.gradebox .g{font-size:27px; font-weight:700; letter-spacing:-.04em; line-height:1.05;
  font-variant-numeric:tabular-nums}
.gradebox .gl{font-size:10.5px; font-weight:640; letter-spacing:.06em; text-transform:uppercase; margin-top:2px}
.g-strong,.gl-strong{color:var(--ok)} .g-good,.gl-good{color:var(--good)}
.g-mixed,.gl-mixed{color:var(--warn)} .g-weak,.gl-weak{color:var(--bad)}
.post-main{min-width:0; flex:1}
.post-meta{display:flex; flex-wrap:wrap; gap:10px; font-size:12px; color:var(--fg-faint); margin-bottom:5px}
.post-snip{margin:0 0 10px; font-size:14.5px; line-height:1.5; color:var(--fg);
  display:-webkit-box; -webkit-line-clamp:2; -webkit-box-orient:vertical; overflow:hidden}
.metricline{font-size:12.5px; color:var(--fg-muted); margin-bottom:8px}
.metricline b{color:var(--fg); font-weight:620; font-variant-numeric:tabular-nums}
.caret{flex:none; color:var(--fg-faint); font-size:12px; margin-top:4px; transition:transform .15s ease}
.post.open .caret{transform:rotate(90deg)}
.detail{display:none; border-top:1px solid var(--border); padding:18px 16px; background:var(--surface-2)}
.post.open .detail{display:block}
.fulltext{white-space:pre-wrap; overflow-wrap:anywhere; font-size:14.5px; line-height:1.62;
  margin:0 0 20px; color:var(--fg)}
.fixes{border:1px solid var(--accent-soft); background:var(--accent-soft); border-radius:11px;
  padding:14px 16px; margin:0 0 20px}
.fixes ol{margin:8px 0 0; padding-left:20px}
.fixes li{font-size:14.5px; margin-bottom:3px}
.jgroup{margin-bottom:16px}
.jgroup h4{font-size:11px; font-weight:650; letter-spacing:.08em; text-transform:uppercase;
  color:var(--fg-faint); margin:0 0 8px}
.jrow{display:flex; gap:10px; align-items:baseline; justify-content:space-between;
  padding:6px 0; border-bottom:1px dashed var(--border)}
.jrow:last-child{border-bottom:0}
.jname{font-size:14px; min-width:0; overflow-wrap:anywhere}
.jval{flex:none; text-align:right}
.jhint{display:block; font-size:11.5px; color:var(--fg-faint); margin-top:2px}
.empty{padding:28px 16px; text-align:center; color:var(--fg-muted); font-size:14px}

/* prompt */
.promptbox{position:relative}
.promptbox pre{margin:0; padding:18px; white-space:pre-wrap; overflow-wrap:anywhere;
  font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace; font-size:12.5px; line-height:1.62;
  color:var(--fg); max-height:420px; overflow-y:auto}
.copybar{display:flex; gap:8px; align-items:center; padding:12px 16px; border-bottom:1px solid var(--border)}
.copybar .ok{font-size:13px; color:var(--ok)}

/* methods */
details.methods{margin-top:8px}
details.methods > summary{cursor:pointer; list-style:none; padding:16px 20px; font-weight:600;
  display:flex; align-items:center; gap:10px; font-size:15px}
details.methods > summary::-webkit-details-marker{display:none}
details.methods > summary::before{content:"›"; color:var(--fg-faint); transition:transform .15s ease}
details.methods[open] > summary::before{transform:rotate(90deg)}
.methods-body{padding:0 20px 20px; font-size:14px; color:var(--fg-muted)}
.methods-body h4{font-size:13px; color:var(--fg); margin:18px 0 6px}
.methods-body code{font-family:ui-monospace,Menlo,monospace; font-size:12.5px;
  background:var(--surface-2); border:1px solid var(--border); border-radius:5px; padding:1px 5px}
.methods-body ul{padding-left:20px; margin:6px 0}
footer{padding:40px 0 56px; color:var(--fg-faint); font-size:12.5px}

@media (max-width:480px){ .brand small{display:none} }
@media (max-width:560px){
  .post-head{padding:14px; gap:12px}
  .gradebox{width:52px}
  .gradebox .g{font-size:23px}
  .pad{padding:16px}
  .count{margin-left:0; width:100%}
}
@media (prefers-reduced-motion: reduce){*{transition:none !important; animation:none !important}}
`;
}

function appJs() {
  return `
(function(){
  var D = JSON.parse(document.getElementById("payload").textContent);
  var root = document.documentElement;

  /* theme ------------------------------------------------------------- */
  function setTheme(t){
    root.setAttribute("data-theme", t);
    try{ localStorage.setItem("lca-theme", t); }catch(e){}
    var b = document.getElementById("themeBtn");
    if(b){ b.textContent = t === "dark" ? "☀" : "☾"; b.setAttribute("aria-label", "Switch to " + (t === "dark" ? "light" : "dark") + " mode"); }
  }
  var stored = null;
  try{ stored = localStorage.getItem("lca-theme"); }catch(e){}
  setTheme(stored || (window.matchMedia && window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark"));
  document.getElementById("themeBtn").addEventListener("click", function(){
    setTheme(root.getAttribute("data-theme") === "dark" ? "light" : "dark");
  });

  /* helpers ----------------------------------------------------------- */
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

  /* posts ------------------------------------------------------------- */
  var list = document.getElementById("postList");
  var countEl = document.getElementById("postCount");
  var sortSel = document.getElementById("sortSel");
  var filtSel = document.getElementById("filtSel");
  var q = document.getElementById("searchBox");
  var KEY = D.validated.slice(0, 5);

  function comparator(mode){
    switch(mode){
      case "grade-asc": return function(a,b){ return (a.grade==null?999:a.grade) - (b.grade==null?999:b.grade); };
      case "new":       return function(a,b){ return b.date.localeCompare(a.date); };
      case "old":       return function(a,b){ return a.date.localeCompare(b.date); };
      case "reach":     return function(a,b){ return (b.reach||-1) - (a.reach||-1); };
      case "conv":      return function(a,b){ return (b.conv||-1) - (a.conv||-1); };
      default:          return function(a,b){ return (b.grade==null?-1:b.grade) - (a.grade==null?-1:a.grade); };
    }
  }

  function buildDetail(p){
    var d = el("div", "detail");

    if(p.fixes && p.fixes.length){
      var fx = el("div", "fixes");
      fx.appendChild(el("h3", null, "What would most improve this post"));
      var ol = document.createElement("ol");
      p.fixes.forEach(function(dim){
        var b = p.bands[dim];
        var li = el("li", null, (D.dimLabels[dim] || dim) + (b ? " — currently " + b[1].toLowerCase() + " for you" : ""));
        ol.appendChild(li);
      });
      fx.appendChild(ol);
      d.appendChild(fx);
    }

    d.appendChild(el("h3", null, "Full post"));
    d.appendChild(el("div", "fulltext", p.text || "(no text)"));

    d.appendChild(el("h3", null, "Every judgment on this post"));
    D.groups.forEach(function(g){
      var rows = [];
      g.dims.forEach(function(dim){
        var b = p.bands[dim];
        if(b){
          rows.push({ dim: dim, band: b[0], label: b[1], hint: b[2] });
        } else if(p.choices[dim]){
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
      a.textContent = "Open this post \u2197";
      a.style.fontSize = "13.5px";
      d.appendChild(a);
    }
    return d;
  }

  function card(p){
    var wrap = el("article", "post");
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
    if(!p.hasMetrics) meta.appendChild(el("span", null, "no numbers recorded"));
    main.appendChild(meta);
    main.appendChild(el("p", "post-snip", p.snippet + (p.text.length > 190 ? "…" : "")));

    if(p.hasMetrics && p.impressions != null){
      var m = el("div", "metricline");
      var bits = ["Seen by <b>" + p.impressions.toLocaleString() + "</b> people"];
      if(p.reach != null) bits.push("reach <b>" + pct(p.reach) + "</b> of your followers");
      if(p.conv == null) bits.push("reactions not recorded");
      else if(p.conv > 0 && p.conv < 0.001) bits.push("<b>under 0.1%</b> of viewers reacted");
      else bits.push("<b>" + pct(p.conv) + "</b> of viewers reacted");
      m.innerHTML = bits.join(" · ");
      main.appendChild(m);
    }

    var chips = el("div", "chips");
    KEY.forEach(function(dim){
      var b = p.bands[dim];
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

  function render(){
    var term = (q.value || "").trim().toLowerCase();
    var rows = D.posts.filter(function(p){
      if(filtSel.value === "metrics" && !p.hasMetrics) return false;
      if(filtSel.value === "top" && !(p.grade >= 80)) return false;
      if(filtSel.value === "low" && !(p.grade != null && p.grade < 40)) return false;
      if(term && p.text.toLowerCase().indexOf(term) === -1) return false;
      return true;
    });
    rows.sort(comparator(sortSel.value));
    list.textContent = "";
    if(!rows.length){ list.appendChild(el("div", "empty card", "No posts match that.")); }
    else {
      var frag = document.createDocumentFragment();
      rows.forEach(function(p){ frag.appendChild(card(p)); });
      list.appendChild(frag);
    }
    countEl.textContent = rows.length + " of " + D.posts.length + " posts";
  }

  sortSel.addEventListener("change", render);
  filtSel.addEventListener("change", render);
  q.addEventListener("input", render);
  render();

  /* copy prompt -------------------------------------------------------- */
  var copyBtn = document.getElementById("copyBtn");
  if(copyBtn){
    copyBtn.addEventListener("click", function(){
      var text = document.getElementById("promptText").textContent;
      var done = function(){
        var s = document.getElementById("copyState");
        s.textContent = "Copied";
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
 * Turn the derived cadence into a heading and a sentence. Every branch has to be
 * true of the data that produced it; where there is not enough history to say
 * anything honest, it says only what is countable.
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

function html(data) {
  const c = data.corpus;
  const confirmed = data.findings.filter((f) => f.confirmed);
  const soft = data.findings.filter((f) => !f.confirmed);
  const years = c.volumeByYear ?? [];
  const followerGain = c.followerEnd != null && c.followerStart != null ? c.followerEnd - c.followerStart : null;
  // The volume story is derived, never assumed. A hard-coded "you stopped
  // posting" heading was true of the one corpus this was first built against
  // and is a false accusation against anyone whose output grew.
  const volume = volumeStory(c.cadence, years);
  const counts = data.questionCounts;
  const platform = data.platform;
  const plat = platform ? esc(platform) : 'the platform';
  // null * 100 is 0 in JS, so an unguarded formatter turns "we have no
  // engagement data" into the assertion "your posts got 0.0% reach". That is a
  // fabricated finding, which is the one thing this project must not produce.
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
    // A relative bar, never the rubric number itself. Both bars share a scale,
    // so the visible difference IS the gap the sentence describes.
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

  const payload = JSON.stringify(data).replace(/[<\u2028\u2029]/g, (c) => '\\u' + c.charCodeAt(0).toString(16).padStart(4, '0'));

  return `<!doctype html>
<html lang="en" data-theme="dark">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<title>Content Review</title>
<meta name="description" content="What your writing actually did, in plain English.">
<link rel="icon" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'%3E%3Ctext y='.9em' font-size='90'%3E%F0%9F%93%9D%3C/text%3E%3C/svg%3E">
<style>${css()}</style>
</head>
<body>

<header class="top">
  <div class="wrap top-in">
    <div class="brand">Content Review<small>${esc(dateRange[0])} – ${esc(dateRange[1])}</small></div>
    <nav class="tabs" aria-label="Sections">
      <a href="#doing">Doing</a>
      <a href="#working">Working</a>
      <a href="#posts">Posts</a>
      <a href="#prompt">Prompt</a>
    </nav>
    <button class="iconbtn" id="themeBtn" type="button" aria-label="Switch theme">☀</button>
  </div>
</header>

<main class="wrap">

  <div class="hero">
    <h1>What your writing actually did</h1>
    <p class="lede">${data.summary.posts} posts, read and judged one at a time, then checked against the ones where
      ${plat} gave you real numbers. No jargon below — just what worked, what did not, and what to do next.</p>
  </div>

  <!-- 1 ------------------------------------------------------------- -->
  <section id="doing">
    <p class="eyebrow">Section one</p>
    <h2>How your content is doing</h2>
    <p class="sub">Two things shape every post: how far the platform pushed it, and what people did once they saw it.
      They are worth reading separately.</p>

    <div class="grid stats">
      <div class="card pad stat">
        <div class="k">Posts published</div>
        <div class="v num">${data.summary.posts}</div>
        <div class="d">Since ${esc(dateRange[0])}. ${data.summary.withOutcomes} of them have view and reaction
          numbers attached — the rest predate the export.</div>
      </div>
      <div class="card pad stat">
        <div class="k">Typical reach</div>
        <div class="v num">${pct1(c.medianReachRate) ?? '<span class="nodata">No data</span>'}${pct1(c.medianReachRate) == null ? '' : '<span class="unit">%</span>'}</div>
        <div class="d">${esc(data.outcomes.reach_rate.explainer)}</div>
      </div>
      <div class="card pad stat">
        <div class="k">Typical engagement</div>
        <div class="v num">${pct1(c.medianConversionRate) ?? '<span class="nodata">No data</span>'}${pct1(c.medianConversionRate) == null ? '' : '<span class="unit">%</span>'}</div>
        <div class="d">${esc(data.outcomes.conversion_rate.explainer)}</div>
      </div>
      <div class="card pad stat">
        <div class="k">Followers</div>
        <div class="v num">${(c.followerEnd ?? 0).toLocaleString('en-US')}</div>
        <div class="d">${followerGain != null ? `${followerGain > 0 ? 'Up' : 'Down'} ${Math.abs(followerGain).toLocaleString('en-US')}` : 'Change unknown'} since your first post here.</div>
      </div>
    </div>

    <div class="grid two" style="margin-top:14px">
      <div class="card pad">
        <h3>${esc(volume.title)}</h3>
        <p class="sub" style="margin-bottom:14px">${esc(volume.body)}</p>
        ${volumeChart(years, volume.mute)}
        <p class="note">Posts published per year.</p>
      </div>
      <div class="card pad">
        <h3>${followerGain != null && followerGain > 0 ? 'Your audience kept growing' : 'Your audience over time'}</h3>
        <p class="sub" style="margin-bottom:14px">From ${(c.followerStart ?? 0).toLocaleString('en-US')} to
          ${(c.followerEnd ?? 0).toLocaleString('en-US')} over the same period.</p>
        ${followerChart(c.followers)}
        <p class="note">Followers at the time of each post.</p>
      </div>
    </div>
  </section>

  <!-- 2 ------------------------------------------------------------- -->
  <section id="working">
    <p class="eyebrow">Section two</p>
    <h2>What's working for you</h2>
    <p class="sub">These come from comparing your own posts against each other — the ones that did well against
      the ones that did not. They are about your audience, not about ${plat} in general.</p>

    <div class="card" style="margin-bottom:22px">
      ${confirmed.length ? confirmed.map((f) => findingCard(f, false)).join('') : '<div class="empty">Nothing held up firmly enough to state as a result.</div>'}
    </div>

    ${soft.length ? `
    <h3 style="margin-top:26px">Worth watching</h3>
    <p class="sub">Patterns that showed up, but in fewer posts and without the same weight behind them. Treat these
      as hunches to test, not as rules.</p>
    <div class="card" style="margin-bottom:22px">
      ${soft.map((f) => findingCard(f, true)).join('')}
    </div>` : ''}

    <h3 style="margin-top:26px">The gap between your best posts and your typical post</h3>
    <p class="sub">Same person, same account — but your winners consistently do more of some things and less of
      others. Closing these gaps is the most concrete thing on this page.</p>
    <div class="card">
      ${data.weakSpots.length ? data.weakSpots.map(gapCard).join('') : '<div class="empty">Not enough posts with numbers to compare.</div>'}
    </div>
  </section>

  <!-- 3 ------------------------------------------------------------- -->
  <section id="posts">
    <p class="eyebrow">Section three</p>
    <h2>Your posts, graded</h2>
    <p class="sub">Every post gets a mark out of 100, built only from the things that actually moved your numbers.
      Colours are relative to your own writing: green means better than most of your posts, amber and red mean worse.
      Tap any post to see the full text and every judgment made about it.</p>

    <div class="controls">
      <label class="sr-only" for="sortSel"></label>
      <select id="sortSel" aria-label="Sort posts">
        <option value="grade-desc">Best graded first</option>
        <option value="grade-asc">Worst graded first</option>
        <option value="new">Newest first</option>
        <option value="old">Oldest first</option>
        <option value="reach">Most reach first</option>
        <option value="conv">Most engagement first</option>
      </select>
      <select id="filtSel" aria-label="Filter posts">
        <option value="all">All posts</option>
        <option value="metrics">Only posts with real numbers</option>
        <option value="top">Only strong posts (80+)</option>
        <option value="low">Only weak posts (under 40)</option>
      </select>
      <input type="search" id="searchBox" placeholder="Search post text…" aria-label="Search post text">
      <span class="count num" id="postCount"></span>
    </div>

    <div class="posts" id="postList"></div>
  </section>

  <!-- 4 ------------------------------------------------------------- -->
  <section id="prompt">
    <p class="eyebrow">Section four</p>
    <h2>Your writing prompt</h2>
    <p class="sub">This was written from your own results — the things that earned engagement from your audience,
      and the habits your best posts avoid. Paste it into any assistant along with a draft, before you publish.
      It is not generic advice; every check in it came out of your own posts.</p>
    <div class="card promptbox">
      <div class="copybar">
        <button class="btn" id="copyBtn" type="button">Copy to clipboard</button>
        <span class="ok" id="copyState" role="status" aria-live="polite"></span>
        <span style="font-size:12px;color:var(--fg-faint)">scroll inside the box for the rest</span>
      </div>
      <pre id="promptText">${esc(data.writingPrompt ?? 'No prompt could be generated.')}</pre>
    </div>
  </section>

  <!-- 5 ------------------------------------------------------------- -->
  <section id="methods">
    <div class="card">
      <details class="methods">
        <summary>How this was worked out</summary>
        <div class="methods-body">
          <p>Everything above avoids technical language on purpose. This section does not — it is here so the
            numbers can be checked rather than trusted.</p>

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
 *
 * @param {object} report  exactly what buildReport() returned
 * @param {object} [opts]
 * @param {Array}  [opts.ratings]   rows from ratings.jsonl, for Choice answers
 * @param {object} [opts.pack]      the rubric pack, for question groups and counts
 * @param {string} [opts.platform]  display name, e.g. "LinkedIn"; omitted stays generic
 * @returns {string} a self-contained HTML document
 */
export function buildDashboard(report, opts = {}) {
  if (!report || !Array.isArray(report.posts)) {
    throw new Error('buildDashboard needs the object buildReport() returned');
  }
  if (!report.corpus) {
    // A report.json written before corpusFacts existed. Say which file is stale
    // rather than letting the first property access throw somewhere opaque.
    throw new Error(
      'this report.json predates the dashboard and has no "corpus" field. Re-run "jev-writer analyze".',
    );
  }
  return html(buildData(report, opts));
}
