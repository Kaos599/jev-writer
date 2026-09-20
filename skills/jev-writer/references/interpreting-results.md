# Reading `report.json` without overstating it

`jev-out/report.json` is the only file you should build a summary or advice from.
The statistics have already been run and translated; your job is to render the
conclusions, not to re-derive them. The shipped dashboard reads this same file
and nothing else.

The single most important rule: **this tool's value is that it refuses to
flatter.** Dozens of products already tell people their content is great. If you
soften a null result or promote an exploratory correlation to a finding, you have
turned it into one of them.

## The shape

```
generatedAt    ISO timestamp
pack           { id, version }
summary        posts, rated, withOutcomes, dateRange
power          per outcome: n, nTests, criticalR, minimumDetectableEffect,
               expectedFalsePositives, verdict, headline
outcomes       the outcome definitions, with labels and explainers
findings[]     sentence, confirmed, dimension, dimensionLabel, outcome,
               outcomeLabel, comparison, direction, tier
validated[]    { dimension, weight } for dimensions that predicted something
weakSpots[]    dimension, label, direction, typical, winners, gap, gapShare, advice
bandEdges      the quintile cut points used, per dimension
corpus         volumeByYear, cadence, followers, medians, totals
posts[]        every corpus field, plus grade, bands {per dimension}, fixes[]
writingPrompt  a ready-to-paste string, or null
```

Findings also carry a `_stats` object. It exists for the collapsed methods
appendix only. Anything in it is statistics vocabulary and must not reach the
main surface.

## `power` decides what you are allowed to say

`power` is keyed by outcome, so check the one you are about to quote.

- **`verdict: 'descriptive'`** means fewer than 25 posts carry data for that
  outcome. No correlational claim may be made for it at all. Say so plainly:
  *"you have N posts with engagement data, which isn't enough to separate signal
  from noise yet."* Show descriptives, suggest re-running later. Do not hedge
  your way into a finding.
- **`verdict: 'weak'`** is between 25 and 60. Findings are permitted but only the
  pre-registered ones, and the sample-size caveat belongs somewhere visible.
- **`verdict: 'report'`** is 60 or more.

False-discovery correction is applied in every case where correlations run at
all, not only above 60.

## `findings[]`: only `confirmed` ones are findings

Each finding carries a `sentence` already written in plain English. Use it
verbatim where you can; it was written to avoid statistics vocabulary.

- `confirmed: true` means the question was **pre-registered** as a primary
  hypothesis before any result was seen, and it survived false-discovery
  correction on the p-value computed *after* controlling for publication date.
  These are evidence.
- `confirmed: false` means exploratory. These are **hypotheses for the next batch
  of data**, not conclusions. Render them de-emphasised, labelled, and never in a
  headline. If the user asks "so what should I change", answer only from
  confirmed findings.

Findings are sorted confirmed-first, then by effect size.

## `weakSpots[]`: lead with this

This is the most actionable section and the one users respond to. Each entry
compares a **typical** post against that person's **own best-performing** posts
on one dimension, and `advice` is a finished sentence. `gap` is already
direction-aware, so a positive gap always means the winners do more of the good
thing, whichever way the dimension runs.

Weak spots are only computed over dimensions that validated against an outcome,
and only when there are at least nine posts with a conversion rate to draw a top
third from. An empty array is a legitimate result.

An earlier version of this file counted how many posts fell in the bottom two
bands. That was meaningless: bands are quintiles of the person's own
distribution, so the bottom two are 40% of posts by construction and every
dimension scored exactly 40%. If you ever find yourself computing "share of posts
in a low band", you have reintroduced that bug.

## `posts[].bands`: render, never derive

Every rated dimension is banded Poor / Weak / Typical / Strong / Excellent
against the author's own distribution, and **the band is already
direction-aware**.

This matters: a high `ai_generated_feel` is bad, a high `specificity` is good.
If you colour by raw value you will paint the worst posts green. Use
`bands[dim].label` and `bands[dim].band`, never the raw `value`, for anything the
user sees.

`neutral` dimensions such as `technicality` are descriptive rather than better or
worse. Do not colour them as though more is better.

Choice questions are not banded. They have no ordering to band, so they do not
appear in `bands` and are read from `ratings.jsonl` instead.

## `posts[].grade`

A 0 to 100 score built **only from dimensions validated against this person's own
outcomes**, not from every rated dimension. A composite over everything would be
a vibe; a composite over what actually moved their numbers is a prediction.

`grade` is `null` when nothing validated. That is a legitimate outcome, usually
because the sample was too small. Show the posts without grades rather than
inventing a score.

`fixes[]` on each post names up to three validated dimensions where that post
sits below Strong. It is the honest answer to "what would most improve this one".

## `writingPrompt`

Hand this to the user verbatim, in a copy-to-clipboard box. It is generated from
their own results: the dimensions that predicted engagement for them, what to aim
for in each, and where their best posts differ from their typical one.

It is `null` when there were no findings. Do not substitute generic writing
advice. The absence of a prompt is itself honest information.

## `corpus`

The part that needs no model and no statistics: `volumeByYear`, `followers`,
median reach and conversion rates, totals. `corpus.cadence` describes how posting
volume actually moved (`rising`, `steady`, `declined`, `collapsed`) and is `null`
when there is less than two years of history. Derive the sentence from it rather
than asserting a trend. An earlier dashboard hard-coded "you stopped posting",
which was true of exactly one corpus.

## Rubric health

If a dimension's mean confidence across the corpus sits near 0.5, its levels do
not discriminate and its number should not be quoted. Confidence lives on each
row in `ratings.jsonl`, not in `report.json`. This is a property no
prompt-and-parse pipeline can measure, and it is worth surfacing: it tells the
user which parts of the rubric to rewrite.

## Corpus warnings

`build` prints warnings that never reach `report.json`: unparseable dates in an
export, a follower total that fails its consistency check, days carrying more
than one post. Any of these means some fields are null on purpose. If a user asks
why a post has no metrics, the answer is usually in that output rather than in
the report.

## Things to say out loud

- Associations in one person's history, not causation.
- Unmeasured confounders: posting time, follower composition, platform ranking
  changes.
- Typed output guarantees the interface, not the truth. Jev is calibrated, which
  is not the same as correct.
