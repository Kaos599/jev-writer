# AGENTS.md

Instructions for coding agents working in this repository.

## What this project is

A tool that finds which qualities of a person's writing actually predict
engagement, by rating their published posts with Jev (TypeSafe AI's System One
model) and testing those ratings against their real engagement data.

**It analyses posts. It does not write them.** Jev is not trained to generate
text. If you are asked to add a drafting or rewriting feature, say that the
underlying model cannot do it and propose the analysis-side equivalent.

## The one rule that governs everything

**This tool's value is that it refuses to flatter.** Dozens of products already
tell people their content is great. Every design decision here trades
persuasiveness for honesty, and reviewers should reject changes that reverse
that trade.

Concretely, do not:

- report an exploratory correlation as a finding,
- remove or weaken the power gate,
- present a number whose uncertainty is not also presented,
- let a rubric see the outcome it is meant to predict,
- soften a null result into a hedge.

If a change makes the output more impressive and less defensible, it is wrong.

## Layout

```
src/stats.mjs            rank correlation, permutation tests, the power gate
src/report.mjs           the statistics -> English boundary. Read this first.
src/rubrics/pack.mjs     pack format and validation
src/rubrics/*.mjs        shipped packs
src/adapters/*.mjs       platform export parsing
src/providers/*.mjs      one file per transport
src/cli.mjs              doctor / build / rate / analyze / run
skills/jev-notetaker/    the agent skill and its references
test/                    node:test, no framework
```

`src/report.mjs` is the most important file to understand. Everything above it
speaks statistics; everything below it speaks English. No p-value, rho or
confidence interval may cross that boundary onto a user-facing surface.

## Conventions

- **ESM only**, Node >= 20, no TypeScript, no build step.
- **One runtime dependency** (`ai`, required by the AI Gateway path). Do not add
  more without a strong reason; the CSV and xlsx readers are hand-written
  specifically to avoid dependencies.
- **Comments explain why, not what.** Several comments in this repo record a
  measured fact or a bug that was actually hit — those are load-bearing
  documentation, not clutter. Do not strip them.
- Tests use `node:test` and synthetic fixtures. **No real post data in the
  repository, ever.**

## Things that will bite you

- **AI Gateway exposes evaluation only through the AI SDK's
  `experimental_evaluate`**, not through its OpenAI-compatible endpoints, and it
  needs `ai` >= 7.0.105. This is why there is no plain-HTTP gateway adapter.
- **Provider dialects differ.** The AI SDK says `boolean` and returns
  `{probability}`; OpenRouter and TypeSafe say `noul` and return `{noul}`. Packs
  are authored in the AI SDK dialect and each provider translates.
- **Near-ties in a Choice distribution** can land on an exact tie, which the AI
  SDK rejects with "did not select a highest-probability option". That is
  sampling noise on a genuinely ambiguous item; retry the repetition, never drop
  the item.
- **`score` accepts 2–10 levels only.** The API rejects anything else.
- **Rubric wording is load-bearing.** Tightening one clause moved a judgment from
  0.99 to 0.71 on identical input. Treat pack edits as breaking changes: bump the
  version and re-rate rather than pooling ratings across wordings.
- **Bands are direction-aware.** Never colour or rank by a raw rubric value.
- **Bands are quintiles**, so "share of posts in the bottom two bands" is 40% by
  construction. That bug shipped once; do not reintroduce it.

## Statistics rules

- **Spearman rank, never Pearson, on rubric values.** Jev's score magnitudes are
  explicitly not numerically calibrated and its docs warn against interpolating
  between levels.
- **Permutation p-values and bootstrap CIs**, not normal approximations; n is
  routinely under 60.
- **Control for publication date** on any headline result. A rated dimension and
  an outcome that both drift over time correlate for no reason.
- **Keep the two outcomes separate.** `reach_rate` is impressions over followers
  at post time; `conversion_rate` is engagements over impressions. They answer
  different questions and must not be blended into one score.

## Privacy

This tool sends private writing to a third party. `.gitignore` excludes `data/`,
`out/` and `*.jsonl`. A generated dashboard embeds full post text, so it is
generated, never committed. Zero Data Retention is requested on every gateway
call. Never ask a user to paste an API key into a chat.

## Before you open a PR

```bash
npm test                  # node:test, all must pass
node src/cli.mjs doctor   # validates every pack and makes one live call
```

Add a test for any new statistic or pack-validation rule. Several existing tests
exist because they caught a real bug — read them before changing behaviour they
pin.
