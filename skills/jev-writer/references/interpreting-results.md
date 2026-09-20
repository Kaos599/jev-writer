# Reading `report.json` without overstating it

`report.json` is the only file you should build a dashboard, a summary or advice
from. The statistics have already been run and translated; your job is to render
the conclusions, not to re-derive them.

The single most important rule: **this tool's value is that it refuses to
flatter.** Dozens of products already tell people their content is great. If you
soften a null result or promote an exploratory correlation to a finding, you have
turned it into one of them.

## The shape

```
summary        posts, rated, withOutcomes, dateRange
power          per outcome: verdict, criticalR, minimumDetectableEffect, headline
findings[]     sentence, confirmed, dimension, outcome, comparison, direction
weakSpots[]    dimension, advice, typical, winners, gap
validated[]    the dimensions that actually predicted something
posts[]        grade {score, parts}, bands {per dimension}, fixes[]
bandEdges      the quintile cut points used, per dimension
writingPrompt  a ready-to-paste string, or null
```

## `power` decides what you are allowed to say

Check this before quoting anything.

- **`verdict: 'descriptive'`** — fewer than 25 posts carry outcome data. No
  correlational claim may be made at all. Say so plainly: *"you have N posts with
  engagement data, which isn't enough to separate signal from noise yet."* Show
  descriptives, suggest re-running later. Do not hedge your way into a finding.
- **`verdict: 'weak'`** — between 25 and 60. Findings are permitted but only the
  pre-registered ones, and the sample-size caveat belongs somewhere visible.
- **`verdict: 'report'`** — 60 or more. False-discovery correction is applied.

## `findings[]` — only `confirmed` ones are findings

Each finding carries a `sentence` already written in plain English. Use it
verbatim where you can; it was written to avoid statistics vocabulary.

- `confirmed: true` means the question was **pre-registered** as a primary
  hypothesis before any result was seen, and it survived the significance test
  after controlling for publication date. These are evidence.
- `confirmed: false` means exploratory. These are **hypotheses for the next batch
  of data**, not conclusions. Render them de-emphasised, labelled, and never in a
  headline. If the user asks "so what should I change", answer only from
  confirmed findings.

Findings are sorted confirmed-first, then by effect size.

## `weakSpots[]` — lead with this

This is the most actionable section and the one users respond to. Each entry
compares a **typical** post against that person's **own best-performing** posts
on one dimension, and `advice` is a finished sentence.

An earlier version of this file counted how many posts fell in the bottom two
bands. That was meaningless — bands are quintiles of the person's own
distribution, so the bottom two are 40% of posts by construction and every
dimension scored exactly 40%. If you ever find yourself computing "share of posts
in a low band", you have reintroduced that bug.

## `posts[].bands` — render, never derive

Every dimension is banded Poor / Weak / Typical / Strong / Excellent against the
author's own distribution, and **the band is already direction-aware**.

This matters: a high `ai_generated_feel` is bad, a high `specificity` is good.
If you colour by raw value you will paint the worst posts green. Use
`bands[dim].label` and `bands[dim].band`, never the raw `value`, for anything the
user sees.

`neutral` dimensions such as `technicality` are descriptive rather than better or
worse. Do not colour them as though more is better.

## `posts[].grade`

A 0–100 score built **only from dimensions validated against this person's own
outcomes** — not from all 30. A composite over everything would be a vibe; a
composite over what actually moved their numbers is a prediction.

`grade` is `null` when nothing validated. That is a legitimate outcome, usually
because the sample was too small. Show the posts without grades rather than
inventing a score.

## `writingPrompt`

Hand this to the user verbatim, in a copy-to-clipboard box. It is generated from
their own results: the dimensions that predicted engagement for them, what to aim
for in each, and where their best posts differ from their typical one.

It is `null` when there were no findings. Do not substitute generic writing
advice — the absence of a prompt is itself honest information.

## Rubric health

If a dimension's mean confidence across the corpus sits near 0.5, its levels do
not discriminate and its number should not be quoted. This is a property no
prompt-and-parse pipeline can measure, and it is worth surfacing: it tells the
user which parts of the rubric to rewrite.

## Things to say out loud

- Associations in one person's history, not causation.
- Unmeasured confounders: posting time, follower composition, platform ranking
  changes.
- Typed output guarantees the interface, not the truth. Jev is calibrated, which
  is not the same as correct.
