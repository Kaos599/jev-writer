# The dashboard: why it looks like this

**You do not need to build a dashboard.** `jev-writer dashboard` renders one, and
`run` calls it as its last step:

```bash
node src/cli.mjs dashboard      # or: npx github:Kaos599/jev-writer dashboard
open jev-out/dashboard.html
```

It reads `jev-out/report.json` and writes `jev-out/dashboard.html`. If the report
is missing it tells you to run `analyze` first.

This file is here for two reasons. It records **why** the shipped page is shaped
the way it is, so nobody redesigns it back into the version that failed. And it
is the **specification** if someone genuinely needs a custom one, inside their
own React or Next.js project or in a different shape.

## What got rejected, and why

An earlier version of this dashboard was shown to a real user, who called it
"more slop". It was a correct piece of data analysis and a failed piece of
product. The specific complaints, which are now rules:

- It printed `rho` and `p` on the main surface. The user asked, reasonably,
  "what is rho?" If a reader has to look up a symbol, the number should not
  have been shown.
- It showed raw rubric values like `1.10` on a 0 to 3 scale with no anchor, so
  nothing could be judged good or bad.
- It led with scatter plots of rubric values against outcomes, which communicate
  nothing to someone who does not already know what a correlation looks like.
- It was dense, grey, and read like a research paper when the user wanted to
  know whether their posts were any good.

## Non-negotiable rules

The shipped page follows all of these. A custom one must too.

1. **No statistics vocabulary on the main surface.** Not `rho`, `p =`, `CI`,
   `correlation`, `Spearman`, `significant`, `n=`. These may appear only inside
   one collapsed "How this was worked out" section at the bottom.
2. **Bands and colour, never raw rubric numbers.** Render `bands[dim].label`
   (Poor / Weak / Typical / Strong / Excellent). Green for excellent and strong,
   neutral grey for typical, amber for weak, red for poor. The band arrives
   direction-aware from the report. Render it, never recompute it, never assume
   high is good.
3. **Lead with sentences.** `findings[].sentence` is the headline. It is already
   written for a human.
4. **Grade every post 0 to 100** with a plain word attached: Strong, Good, Mixed,
   Weak. `posts[].grade` is `null` when nothing validated; show the post without
   a grade rather than inventing one.
5. **Explain every percentage.** "Reach" and "engagement rate" are not
   self-evident; each needs one line saying what it means.
6. **No scatter plots of rubric values against outcomes.** Charts only where they
   carry something a sentence cannot, such as a volume collapse across years or
   follower growth over time.
7. **Exploratory results are visually de-emphasised and labelled.** A user
   skimming must not be able to mistake one for a finding.
8. **Narrative sentences are derived, not templated.** An earlier version
   hard-coded "you stopped posting", which was true of exactly one corpus and
   reads as a false accusation against anyone whose volume grew. `corpus.cadence`
   in the report carries the derived answer; use it.

## Structure that works

This is the order the shipped page uses.

1. **How your content is doing.** Volume by year, median reach and engagement
   with plain explanations, follower growth.
2. **What's working for you.** Confirmed findings as large readable statements,
   then `weakSpots` as "the gap between your best posts and your typical post".
   This is the section users act on; put it high.
3. **Your posts, graded.** Sortable, grade first. Click to expand into the full
   text, every judgment as a coloured band with its level description in words,
   and the `fixes` list as "what would most improve this post".
4. **Your writing prompt.** `report.writingPrompt` in a copy-to-clipboard box,
   with one line explaining it was generated from their own results.
5. **How this was worked out.** Collapsed. Methodology, sample size, caveats, and
   the only place statistical detail is allowed.

Judgments inside the expanded post view are grouped into families. A pack may
declare its own `groups`; the LinkedIn pack declares five, covering all thirty
questions. Grouping is presentation only and never touches how a question is
asked, rated or correlated, and anything a pack does not place falls into a
catch-all so a new pack renders sensibly on day one.

## Building a custom one

Build from `report.json` only. Everything in that file has already been
interpreted; re-deriving statistics in a renderer is how the rules above get
broken.

The easiest starting point is the shipped renderer itself, which does no I/O:

```js
import { buildDashboard } from 'jev-writer/dashboard.mjs';

const html = buildDashboard(report, { ratings, pack, platform: 'LinkedIn' });
```

`report` is exactly what `buildReport` returned. `ratings` is the parsed rows of
`ratings.jsonl`, used for Choice answers. `pack` supplies question groups and
counts. `platform` is a display name, and leaving it out keeps the copy generic.
All three options are optional.

If you are writing a page from scratch, default to a **single self-contained HTML
file**: inline CSS and JS, data embedded as a JS object, no CDN, no fetch, no
build step, opening by double-click over `file://`. That is what the shipped page
does, and it is why it works on a laptop with no network.

If the user already has a React or Next.js project and wants it there, shadcn/ui
maps cleanly onto this structure: `Card` per post, `Badge` for band chips,
`Table` for the graded list, `Tabs` for sections, `Collapsible` for the
methodology, `Progress` for a grade bar. Do not introduce a build step into a
project that does not already have one.

## Visual conventions

Dark-mode-first, working in both themes. Define colours as custom properties on
`:root`, redefine under `@media (prefers-color-scheme: dark)` guarded by
`:root:not([data-theme="light"])`, and again under `:root[data-theme="dark"]` for
an explicit toggle. Give `body` an explicit background.

Subtle borders, rounded corners, muted foreground for secondary text, badge chips
for bands. Generous whitespace. Strong typographic hierarchy, so the grade and
the findings are the largest things on the page. Tabular numerals
(`font-variant-numeric: tabular-nums`) for every figure so columns align.

Must work at phone width with a 16px gutter and no horizontal scroll.

## Colour and accessibility

Do not encode meaning in colour alone. Every band carries its word as well as its
colour, so the page survives greyscale and colour blindness. Keep contrast at
4.5:1 for body text in both themes.

## Privacy

The page embeds the full text of every post. It is written to `jev-out/`, which
is gitignored, and it is generated rather than committed. A custom renderer
inherits that obligation.
