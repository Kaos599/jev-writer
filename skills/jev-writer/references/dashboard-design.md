# Building the dashboard

The dashboard is the deliverable most users actually look at. Build it from
`report.json` only — everything in that file has already been interpreted.

## What got rejected, and why

An earlier version of this dashboard was shown to a real user, who called it
"more slop". It was a correct piece of data analysis and a failed piece of
product. The specific complaints, which are now rules:

- It printed `rho` and `p` on the main surface. The user asked, reasonably,
  "what is rho?" If a reader has to look up a symbol, the number should not
  have been shown.
- It showed raw rubric values like `1.10` on a 0–3 scale with no anchor, so
  nothing could be judged good or bad.
- It led with scatter plots of rubric values against outcomes, which communicate
  nothing to someone who does not already know what a correlation looks like.
- It was dense, grey, and read like a research paper when the user wanted to
  know whether their posts were any good.

## Non-negotiable rules

1. **No statistics vocabulary on the main surface.** Not `rho`, `p =`, `CI`,
   `correlation`, `Spearman`, `significant`, `n=`. These may appear only inside
   one collapsed "How this was worked out" section at the bottom.
2. **Bands and colour, never raw rubric numbers.** Render `bands[dim].label`
   (Poor / Weak / Typical / Strong / Excellent). Green for excellent and strong,
   neutral grey for typical, amber for weak, red for poor. The band is already
   direction-aware — render it, never recompute it, never assume high is good.
3. **Lead with sentences.** `findings[].sentence` is the headline. It is already
   written for a human.
4. **Grade every post 0–100** with a plain word attached: Strong, Good, Mixed,
   Weak.
5. **Explain every percentage.** "Reach" and "engagement rate" are not
   self-evident; each needs one line saying what it means.
6. **No scatter plots of rubric values against outcomes.** Charts only where they
   carry something a sentence cannot — a volume collapse across years, follower
   growth over time.
7. **Exploratory results are visually de-emphasised and labelled.** A user
   skimming must not be able to mistake one for a finding.

## Structure that works

1. **How your content is doing** — volume by year, median reach and engagement
   with plain explanations, follower growth.
2. **What's working for you** — confirmed findings as large readable statements,
   then `weakSpots` as "the gap between your best posts and your typical post".
   This is the section users act on; put it high.
3. **Your posts, graded** — sortable, grade first. Click to expand into the full
   text, every judgment as a coloured band with its level description in words,
   and the `fixes` list as "what would most improve this post".
4. **Your writing prompt** — `report.writingPrompt` in a copy-to-clipboard box,
   with one line explaining it was generated from their own results.
5. **How this was worked out** — collapsed. Methodology, sample size, caveats,
   and the only place statistical detail is allowed.

## Implementation

Default to a **single self-contained HTML file**: inline CSS and JS, data
embedded as a JS object, no CDN, no fetch, no build step. It must open by
double-clicking with `file://`. Also write a small generator script so the
dashboard can be regenerated when data changes rather than becoming a dead file.

If the user already has a React or Next.js project and wants it there,
shadcn/ui maps cleanly onto this structure: `Card` per post, `Badge` for band
chips, `Table` for the graded list, `Tabs` for sections, `Collapsible` for the
methodology, `Progress` for a grade bar. Do not introduce a build step into a
project that does not already have one.

## Visual conventions

Dark-mode-first, working in both themes. Define colours as custom properties on
`:root`, redefine under `@media (prefers-color-scheme: dark)` guarded by
`:root:not([data-theme="light"])`, and again under `:root[data-theme="dark"]` for
an explicit toggle. Give `body` an explicit background.

Subtle borders, rounded corners, muted foreground for secondary text, badge chips
for bands. Generous whitespace. Strong typographic hierarchy — the grade and the
findings should be the largest things on the page. Tabular numerals
(`font-variant-numeric: tabular-nums`) for every figure so columns align.

Must work at phone width with a 16px gutter and no horizontal scroll.

## Colour and accessibility

Do not encode meaning in colour alone — every band carries its word as well as
its colour, so the page survives greyscale and colour blindness. Keep contrast at
4.5:1 for body text in both themes.
