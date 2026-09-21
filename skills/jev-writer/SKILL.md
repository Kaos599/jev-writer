---
name: jev-writer
description: >
  Analyse published writing or pre-flight audit drafts to find which qualities
  predict engagement or meet technical craft bars. Supports LinkedIn posts,
  technical blogs, technical short-form posts/threads, and general essays.
  Walks users through exports, API keys, and pre-flight reviews. Analyses
  existing writing; it does not write or generate text.
license: MIT
---

# Analysing writing against real engagement and craft rubrics

This skill turns "why do some of my posts work?" and "is my technical writing
rigorous and free of slop?" into answers grounded in real data and calibrated
rubric evaluations. You can evaluate a whole corpus of published writing or
run a fast pre-flight audit on an unpublished draft (`.md` or `.txt`).

**The whole value is honesty.** A dozen tools already tell people their content
is great. This one tells them when their sample is too small to know, when a
rubric is broken, when a technical post lacks checkable proof artifacts, and
when the thing they are proud of predicted nothing. Do not soften that. A
flattering answer is a useless answer.

## What this cannot do

Say this early and plainly if the user seems to expect otherwise:

- **It does not write or rewrite posts.** Jev is a System One model and is not
  trained to generate text. It returns typed judgments and probabilities.
- **It cannot recover engagement data the platform no longer exposes.** On
  LinkedIn, impressions exist for roughly the last 12 months and the top 50
  posts. Older engagement is gone for everyone, including the platform's own UI.
- **It cannot establish causation.** Everything it finds is an association in
  one person's history, with unmeasured confounders.

## Step 1. Select the content type and rubric pack

`jev-writer` ships with four calibrated rubric packs. Always identify which format the user is evaluating:

| Format / Goal | Recommended Pack | Focus & Mechanics |
| --- | --- | --- |
| **LinkedIn creator post** | `linkedin-post` | Attention, ~210-character preview before cut, viral reach vs conversion, comments-vs-reactions, algorithmic down-ranking risks. |
| **Technical short-form / thread** | `technical-post` | Short technical posts (LinkedIn/X): hook stopping power, proof artifacts in opening 3 lines, mechanism over adjectives, peer respect, tradeoff disclosure. |
| **Technical blog / deep dive** | `technical-blog` | Long-form engineering essays, architecture teardowns, benchmarks, post-mortems: concrete system anchors, domain/physical constraints, checkable proof artifacts, executable decision procedures. |
| **General essay / blog / newsletter** | `general-writing` | Platform-agnostic prose craft: thesis clarity, logical argument progression, information density, intellectual honesty, voice authenticity, anti-slop. |

For detailed question lists and design philosophy per pack, consult `references/packs.md`.

### Getting corpus data
- **LinkedIn:** Requires both the larger data archive (`Shares_*.csv`) and the creator post analytics export (`.xlsx`). See `references/platform-exports.md`.
- **Markdown / Text Archives (Blog posts, essays):** Put any directory of `.md` or `.txt` files into a folder (e.g. `./posts`). The text adapter automatically parses markdown headers, YAML frontmatter (`title:`, `date:`), and computes text features.

## Step 2. Get a key

Any one of three works, and the tool auto-detects which is present:

| Provider | Env var | Notes |
| --- | --- | --- |
| Vercel AI Gateway | `AI_GATEWAY_API_KEY` | Easiest if they have a Vercel account (`typesafe-ai/jev`) |
| OpenRouter | `OPENROUTER_API_KEY` | Easiest if they already use OpenRouter (`typesafe/jev-latest`) |
| TypeSafe direct | `TYPESAFE_API_KEY` | From console.typesafe.ai |

Jev is priced at $0.042 per million input tokens with output free, so auditing a single post costs fractions of a cent, and a few hundred posts costs cents. Check current pricing before a large run.

Never ask the user to paste a key into the chat. Have them set it in their
environment or a local `.env`, then run `doctor`.

Details per provider in `references/providers.md`.

## Step 3. Pre-flight audit a single draft or run the corpus pipeline

### Option A: Pre-flight Audit a Single Post / Article

Before publishing, evaluate a draft directly from a markdown file, text file, or stdin:

```bash
# Audit an engineering blog post against the technical blog rubric
node src/cli.mjs audit my-post.md --pack technical-blog

# Audit a short-form post against the technical post rubric
node src/cli.mjs audit snippet.md --pack technical-post

# Audit a general article or essay
node src/cli.mjs audit essay.md --pack general-writing

# Output formatted Markdown scorecard (ideal for agent reviews or CI)
node src/cli.mjs audit my-post.md --pack technical-blog --md
```

This returns an honest, unvarnished pre-flight scorecard:
- **Attention & Opening:** Hook strength, opening archetype, payoff delivery.
- **Craft & Substance:** Specificity, checkable proof artifacts, mechanism explanation, information density.
- **Anti-Slop Gates:** AI-generated feel, stock cliches, peer respect, failure-framing detection.
- **Most Needed Improvement:** The single highest-leverage dimension to fix before publishing.

### Option B: Run Corpus Analysis Across Historical Posts

The package is not published to npm. These invocations work from a clone or npx:

```bash
# Verify environment, keys, and packs
node src/cli.mjs doctor

# Build corpus from a directory of markdown files or LinkedIn exports
node src/cli.mjs build ./posts --adapter text
# Or for LinkedIn exports:
node src/cli.mjs build ./exports --adapter linkedin

# Rate the corpus with the selected pack
node src/cli.mjs rate --pack technical-blog

# Correlate against outcomes with power gate
node src/cli.mjs analyze

# Render self-contained HTML dashboard
node src/cli.mjs dashboard --pack technical-blog

# Or run end-to-end:
node src/cli.mjs run ./posts --adapter text --pack technical-blog
```

`doctor` first, always. It catches a missing key, an `ai` package too old for
the Gateway path, and any invalid pack before spending calls.

### The commands

| Command | What it does |
| --- | --- |
| `doctor` | check Node, keys, every pack; make one live call |
| `audit <file> [--pack <id>]` | pre-flight audit a single post/article against a rubric pack |
| `build <dir> [--adapter text\|linkedin]` | parse exports or markdown files into `corpus.jsonl` |
| `rate [--pack <id>]` | rate the corpus, resumable after an interruption |
| `analyze` | correlate against outcomes, write `report.json` |
| `dashboard [--pack <id>]` | render `report.json` to `dashboard.html` |
| `run <dir> [--adapter ..] [--pack ..]` | build, rate, analyze, dashboard, in order |

Everything lands in `jev-out/`, overridable with the `JEV_WRITER_OUT`
environment variable: `corpus.jsonl`, `ratings.jsonl`, `report.json`,
`dashboard.html`.

**`report.json` is the artifact everything else is built from.** Both it and
`dashboard.html` embed the full text of every post. `jev-out/` is gitignored;
never commit either file, and never paste a whole corpus into a chat.

If `rate` is interrupted, run it again. It reads `ratings.jsonl` and skips posts
already done rather than paying for them twice.

## Step 4. Read the report honestly

`report.json` has already done the interpretation. It contains no p-values on its
main surface, and you should not reintroduce any.

- `findings[]` each carry a `sentence` written in plain English and a `confirmed`
  flag. **Only `confirmed: true` findings are findings.** Everything else is
  exploratory: present it as "worth watching", never as a conclusion.
- `power` is keyed by outcome. If a `verdict` is `descriptive`, the sample is too
  small and **no correlational claim may be made for that outcome at all**. Say
  so directly: "you have N posts with engagement data, which is not enough to
  tell signal from noise yet." Offer descriptives and suggest re-running after
  more posts.
- `weakSpots[]` is the gap between their typical post and their own
  best-performing posts. This is the most actionable section; lead with it.
- `posts[].grade` and `posts[].bands` are per-post grades and direction-aware
  bands. **Never recompute a band or assume a high value is good.** Direction is
  metadata on the pack: high `ai_generated_feel` is bad, high `specificity` is
  good.
- `writingPrompt` should be handed over verbatim. It is generated from their own
  results and is the single most useful output for their next draft. It is
  `null` when nothing validated, and that null is honest information rather than
  a bug.

If a rubric's mean confidence across the corpus is near 0.5, its levels do not
discriminate. Flag it rather than quoting its number.

Full guidance in `references/interpreting-results.md`.

## Step 5. Give them the dashboard

The user almost always wants to *see* this. Do not hand-write a page. The tool
renders one:

```bash
node src/cli.mjs dashboard      # or: npx github:Kaos599/jev-writer dashboard
open jev-out/dashboard.html
```

`run` already does this as its last step, so after a full run the file is
waiting. It is one self-contained HTML file: inline CSS, inline JS, data
embedded, no CDN and no fetch, so it opens by double-click with no network. A
178-post corpus renders to about 600 KB.

It reads `report.json` rather than recomputing anything, so what the user sees is
exactly what the report layer concluded. If `report.json` is missing, the command
tells you to run `analyze` first.

Your job after rendering it is to walk them through it and keep the reading
honest: point at `weakSpots`, name which findings are confirmed and which are
only exploratory, and repeat the sample-size caveat if `power` says so.

### Component-first UI construction (Adapting to data depth)

A key strength of this architecture is component-level adaptability. When building or customizing a dashboard, do not assume every user has extensive data like LinkedIn. An author on Medium may have text only and zero metrics; an author on X without Premium may have cadence and text but no impressions.

Consult `references/components.md` for the modular component catalog:
- **Tier 1: Sparse (Text only, e.g. Medium):** Render qualitative rubric profiles, AI-feel distributions, writing style audits, and the writing prompt. Do not attempt correlational or reach charts.
- **Tier 2: Text + Volume (e.g. X / Substack archive):** Add posting volume, cadence velocity, and style evolution over time.
- **Tier 3: Full Text + Outcomes (e.g. LinkedIn):** Full dashboard with reach/engagement metrics, format & hook breakdown matrices, weak spot comparisons, and the Advanced Mode diagnostic table.

AI coding agents and developers can assemble these components using React + shadcn/ui or rely on the shipped standalone renderer.

### If someone wants a custom dashboard

Only when they ask for it inside their own React or Next.js project, or want a
different shape. `references/dashboard-design.md` and `references/components.md` are the specifications. They
record the presentation rules the shipped dashboard follows and why each one
exists. Build from `report.json` only; the data is already interpreted.

The rules that matter most, in short: no statistics vocabulary on the main
surface, bands and colour rather than raw rubric numbers, lead with
`findings[].sentence`, grade every post 0 to 100 with a plain word attached,
explain every percentage, no scatter plots of rubric values against outcomes, and
de-emphasise exploratory results so a skimming reader cannot mistake one for a
finding.

`buildDashboard` is also exported, so a custom renderer can start from the
shipped page rather than from nothing:

```js
import { buildDashboard } from 'jev-writer/dashboard.mjs';

const html = buildDashboard(report, { ratings, pack, platform: 'LinkedIn' });
```

`ratings` is the parsed rows of `ratings.jsonl`, `pack` is the rubric pack, and
`platform` is a display name. All three are optional.

## Extending to other platforms

A rubric pack is a versioned set of typed questions plus the state fields each
question may see. To support a new platform, write an adapter producing items
with text plus an outcome, and a pack. The format lives in `src/rubrics/pack.mjs`
in the repo, and consumers import it as `jev-writer/rubrics/pack.mjs`.

Two rules when authoring a pack:

- **Never ask the model anything code can count.** Length, emoji, hashtags,
  cadence and media type are computed exactly and compete with the judgments.
- **Pre-register every question** as `primary` or `exploratory` before seeing
  results, and give every rated dimension a direction of merit. `validatePack`
  enforces the tier. Directions are a separate `directions` export alongside the
  pack; the report layer throws when one is missing, so a pack without them
  produces no `report.json` and no dashboard.

Rubric wording is load-bearing. In development, tightening one clause moved a
judgment from 0.99 to 0.71 on identical input. Treat pack edits as breaking
changes and re-rate rather than pooling ratings across wordings.

Full guidance in `references/rubric-authoring.md`.

## Reference files

| File | Covers |
| --- | --- |
| `references/components.md` | component-first architecture, UI tokens (shadcn-inspired), progressive tiers 1-3, SVG chart specs |
| `references/providers.md` | getting a key, the three transports, cost, adding a fourth |
| `references/platform-exports.md` | what is exportable from X, Medium, Substack, YouTube, Reddit, Instagram |
| `references/interpreting-results.md` | every field in `report.json` and what may be said about it |
| `references/dashboard-design.md` | why the dashboard looks the way it does, and the spec for a custom one |
| `references/rubric-authoring.md` | writing and validating a pack |

