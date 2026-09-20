---
name: jev-writer
description: >
  Analyse a person's published writing to find which qualities actually predict
  engagement, then build them a dashboard and a personalised review prompt. Use
  when someone wants to know why some of their posts do better than others, wants
  their content audited or graded, asks what to change about their writing, or
  wants a content-analytics dashboard built from their own data. Walks them
  through exporting their data and getting an API key, runs the analysis, and
  refuses to report findings the sample cannot support. Analyses existing posts;
  it does not write them.
license: MIT
---

# Analysing someone's writing against their real engagement

This skill turns "why do some of my posts work?" into an answer grounded in that
person's own data. You will walk them through two downloads and one key, run a
pipeline, and then build them something legible.

**The whole value is honesty.** A dozen tools already tell people their content
is great. This one tells them when their sample is too small to know, when a
rubric is broken, and when the thing they are proud of predicted nothing. Do not
soften that. A flattering answer is a useless answer.

## What this cannot do

Say this early and plainly if the user seems to expect otherwise:

- **It does not write or rewrite posts.** Jev is a System One model and is not
  trained to generate text. It returns typed judgments and probabilities.
- **It cannot recover engagement data the platform no longer exposes.** On
  LinkedIn, impressions exist for roughly the last 12 months and the top ~50
  posts. Older engagement is gone for everyone, including the platform's own UI.
- **It cannot establish causation.** Everything it finds is an association in
  one person's history, with unmeasured confounders.

## Step 1 — get their data

Do not start rating anything until real data is in hand. For LinkedIn the user
needs **both** of these, and they must be told the first one takes hours:

1. **The larger data archive.** Settings → Data Privacy → *Get a copy of your
   data* → **"Download larger data archive"**. The basic archive contains no
   `Shares_*.csv` at all, which is the single most common failure. This gives
   post text, dates and URLs, and **no engagement data whatsoever** — the
   `Reactions.csv` and `Comments.csv` inside it record what they did on *other
   people's* posts.
2. **Post analytics export.** Creator Mode on → Analytics & Tools → Post
   analytics → **Export**. This is the only first-party surface with
   impressions.

Tell them to trigger the archive first, because everything else is blocked on it.
Put both files in one directory.

Never suggest scraping, browser automation against the platform, or third-party
data vendors. The first-party route is free, complete enough, and does not risk
their account.

## Step 2 — get a key

Any one of three works, and the tool auto-detects which is present:

| Provider | Env var | Notes |
| --- | --- | --- |
| Vercel AI Gateway | `AI_GATEWAY_API_KEY` | Easiest if they have a Vercel account |
| OpenRouter | `OPENROUTER_API_KEY` | Easiest if they already use OpenRouter |
| TypeSafe direct | `TYPESAFE_API_KEY` | From console.typesafe.ai |

Jev is priced at $0.042 per million input tokens with output free, so a few
hundred posts costs cents. Check current pricing before a large run.

Never ask the user to paste a key into the chat. Have them set it in their
environment or a local `.env`, then run `doctor`.

## Step 3 — run it

```bash
npx jev-writer doctor          # node, key, pack validation, one live call
npx jev-writer run ./exports   # build corpus, rate it, analyse it
```

`doctor` first, always. It catches a missing key, an `ai` package too old for
the Gateway path, and a broken rubric before a full run spends anything.

Outputs land in `jev-writer-out/`: `corpus.jsonl`, `ratings.jsonl`, and
`report.json`. **`report.json` is the artifact you build everything else from.**

## Step 4 — read the report honestly

`report.json` has already done the interpretation. It contains no p-values on its
main surface, and you should not reintroduce any.

- `findings[]` — each has a `sentence` written in plain English, and a
  `confirmed` flag. **Only `confirmed: true` findings are findings.** Everything
  else is `exploratory`: present it as "worth watching", never as a conclusion.
- `power` — if `verdict` is `descriptive`, the sample is too small and **no
  correlational claim may be made at all**. Say so directly: "you have N posts
  with engagement data, which is not enough to tell signal from noise yet."
  Offer descriptives and suggest re-running after more posts.
- `weakSpots[]` — the gap between their typical post and their own
  best-performing posts. This is the most actionable section; lead with it.
- `posts[].grade` and `posts[].bands` — per-post grades and direction-aware
  bands. **Never recompute a band or assume a high value is good.** Direction is
  metadata on the pack; `ai_generated_feel` high is bad, `specificity` high is
  good.
- `writingPrompt` — hand this to them verbatim. It is generated from their own
  results and is the single most useful output for their next draft.

If a rubric's mean confidence across the corpus is near 0.5, its levels do not
discriminate. Flag it rather than quoting its number.

## Step 5 — build them a dashboard

The user almost always wants to *see* this. Build a dashboard from
`report.json`. You are the renderer; the data is already interpreted.

### Non-negotiable presentation rules

These come from a real user rejecting an earlier version as unreadable:

1. **No statistics vocabulary on the main surface.** No "rho", "p =", "CI",
   "correlation", "significant", "n=". Those belong in one collapsed "how this
   was worked out" section at the bottom, or nowhere.
2. **Bands and colour, not raw numbers.** A rubric value of 1.10 means nothing
   to anyone. Show `bands[dim].label` (Poor / Weak / Typical / Strong /
   Excellent) with colour: green for excellent and strong, grey for typical,
   amber for weak, red for poor. The band is already direction-aware — render
   it, do not derive it.
3. **Lead with sentences, not charts.** `findings[].sentence` is the headline.
   Charts only where they carry something a sentence cannot, such as a volume
   collapse over years.
4. **Grade every post 0–100** with a plain word attached: Strong, Good, Mixed,
   Weak.
5. **Every percentage gets a one-line explanation** of what it means. "Reach" and
   "engagement rate" are not self-evident.
6. **No scatter plots of rubric values against outcomes.** That is the part a
   real user called meaningless.

### Suggested structure

1. How your content is doing — volume by year, median reach and engagement with
   plain explanations, follower growth.
2. What's working for you — confirmed findings as large statements, then
   `weakSpots` as "the gap between your best posts and your typical post".
3. Your posts, graded — sortable, grade-first, click to expand into full text and
   all judgments as coloured bands with their level descriptions in words.
4. Your writing prompt — `report.writingPrompt` in a copy-to-clipboard box.
5. How this was worked out — collapsed; methodology and caveats live here.

### Build guidance

Prefer a **single self-contained HTML file** with inline CSS and JS and the data
embedded, so it opens by double-click with no server and no build step. If the
user already has a React or Next.js project and asks for it there, shadcn/ui
components map cleanly onto this structure: `Card` for each post, `Badge` for
band chips, `Table` for the graded list, `Tabs` for the sections, `Collapsible`
for the methodology. Otherwise implement the same visual conventions — subtle
borders, rounded corners, muted foregrounds, badge chips — in plain CSS.

Dark-mode-first, working in both themes via CSS custom properties. Tabular
numerals for figures. Phone width with no horizontal scroll.

Write a small generator script alongside the HTML so the dashboard can be
regenerated when data changes, rather than being a dead artifact.

## Extending to other platforms

A rubric pack is a versioned set of typed questions plus the state fields each
question may see. To support a new platform, write an adapter producing items
with text plus an outcome, and a pack. See `src/rubrics/pack.mjs`.

Two rules when authoring a pack:

- **Never ask the model anything code can count.** Length, emoji, hashtags,
  cadence and media type are computed exactly and compete with the judgments.
- **Pre-register every question** as `primary` or `exploratory` before seeing
  results, and declare a `direction` for each. Both are enforced by
  `validatePack` and the report layer.

Rubric wording is load-bearing. In development, tightening one clause moved a
judgment from 0.99 to 0.71 on identical input. Treat pack edits as breaking
changes and re-rate rather than pooling ratings across wordings.
