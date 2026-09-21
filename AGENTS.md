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
src/dashboard.mjs        buildReport output -> one self-contained HTML string
src/index.mjs            library entry point, re-exporting the stable surface
src/rubrics/pack.mjs     pack format and validation
src/rubrics/*.mjs        shipped packs, each with its own `directions` export
src/adapters/*.mjs       platform export parsing
src/providers/*.mjs      one file per transport
src/cli.mjs              doctor / build / rate / analyze / dashboard / run
skills/jev-writer/       the agent skill and its six reference files
test/                    node:test, no framework
.github/workflows/ci.yml node 20 and 22, plus a keyless pack-validation smoke job
llms.txt                 the short machine-readable description of the project
```

`src/report.mjs` is the most important file to understand. Everything above it
speaks statistics; everything below it speaks English. No p-value, rho or
confidence interval may cross that boundary onto a user-facing surface.

`src/dashboard.mjs` does no I/O. It takes what `buildReport` returned and gives
back a string; the CLI owns reading and writing files. Keep it that way, so the
page can be rendered from a test or an agent without touching a disk.

## Conventions

- **ESM only**, Node >= 20, no TypeScript, no build step.
- **One runtime dependency** (`ai`, required by the AI Gateway path). Do not add
  more without a strong reason; the CSV and xlsx readers are hand-written
  specifically to avoid dependencies.
- **The `exports` map in `package.json` is the public surface.** Consumers import
  `jev-writer`, `jev-writer/stats.mjs`, `jev-writer/report.mjs`,
  `jev-writer/dashboard.mjs`, `jev-writer/rubrics/pack.mjs`,
  `jev-writer/rubrics/linkedin-post.mjs` or `jev-writer/adapters/linkedin.mjs`.
  A deep path into `src/` no longer resolves from outside the package, so adding
  a module that users need means adding a subpath to that map as well.
- **Comments explain why, not what.** Several comments in this repo record a
  measured fact or a bug that was actually hit. Those are load-bearing
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
- **`score` accepts 2 to 10 levels only.** The API rejects anything else.
- **`validatePack` does not check directions.** It checks ids, types, tiers,
  instructions, score-level counts, the Choice no-match option, and that every
  backticked reference in an instruction names a declared `stateField`. Direction
  of merit is a separate `directions` export beside the pack, and it is the
  report layer that enforces it: `buildReport` throws when a rated dimension has
  no direction, and `cli.mjs` skips report generation with a warning when a pack
  has no directions entry at all. A pack can therefore be structurally valid and
  still produce no `report.json`.
- **Rubric wording is load-bearing.** Tightening one clause moved a judgment from
  0.99 to 0.71 on identical input. Treat pack edits as breaking changes: bump the
  version and re-rate rather than pooling ratings across wordings.
- **Bands are direction-aware.** Never colour or rank by a raw rubric value.
- **Bands are quintiles**, so "share of posts in the bottom two bands" is 40% by
  construction. That bug shipped once; do not reintroduce it.
- **A pack's `groups` are presentation only.** They give the dashboard families
  for the expanded post view and never touch how a question is asked, rated or
  correlated. A pack that declares none still renders, with everything falling
  into one catch-all list.
- **The LinkedIn adapter reports rather than guesses.** Two posts on the same
  date cannot be told apart, because the analytics export joins on date, so
  metrics, post URL and media fields are all left null on those days. The
  follower count is exempt on purpose: it is a per-day value, so two posts on one
  date genuinely share it. Unparseable dates, and a follower total that fails its
  consistency check against the daily rows, each raise a warning rather than
  failing silently. Surface `warnings` to the user; do not swallow them.

### Two statistical bugs that were live, and must not come back

- **Slicing the control array.** An earlier version built the publication-date
  control over the whole subset and then took `control.slice(0, pairs.length)`.
  That is the FIRST n dates, not the dates OF the n surviving items, so a single
  post dropped for a missing rating shifted every later date onto the wrong post
  and silently corrupted the date control that decides whether a finding is
  confirmed. It is fixed in both `src/report.mjs` and `src/cli.mjs` by carrying
  `[value, outcome, date]` triples through one filter, which makes the
  misalignment unrepresentable. Never reintroduce a parallel array that has to be
  filtered in step with another.
- **Truthiness on a metric.** `impressions && engagements ? ... : null` treated a
  genuine zero as missing data. Zero engagements on a real post is the single
  most informative outcome in the file, and dropping it is not random: it removes
  the worst-performing posts from every correlation and pulls the whole analysis
  toward "everything I write is fine". Only a zero *denominator* is undefined.
  Test `Number.isFinite`, never truthiness, on anything that can legitimately be
  zero.

## Statistics rules

- **Spearman rank, never Pearson, on rubric values.** Jev's score magnitudes are
  explicitly not numerically calibrated and its docs warn against interpolating
  between levels.
- **Permutation p-values and bootstrap CIs**, not normal approximations; n is
  routinely under 60.
- **Resampling is seeded, and the seed is reported.** `permutationP`,
  `bootstrapCI` and `testDimension` all take an overridable `seed`, defaulting to
  the exported `DEFAULT_SEED` (20260920), and `testDimension` puts the seed it
  used on the row it returns. A published finding is therefore reproducible by
  anyone holding the same data, and a finding that survives on only one seed was
  never a finding.
- **Control for publication date** on any headline result, and run the
  false-discovery correction on the controlled p-value rather than the raw one.
  A rated dimension and an outcome that both drift over time correlate for no
  reason, and correcting the uncontrolled p would let a result the tool itself
  flagged as shared time drift reach the headline.
- **Keep the two outcomes separate.** `reach_rate` is impressions over followers
  at post time; `conversion_rate` is engagements over impressions. They answer
  different questions and must not be blended into one score.

## Privacy

This tool sends private writing to a third party. `.gitignore` excludes
`jev-out/`, `data/`, `out/`, `*.jsonl`, `dashboard.html` and `report.json`. Both
`report.json` and the generated dashboard embed the full text of every post, so
they are generated, never committed. Zero Data Retention is requested on every
gateway call. Never ask a user to paste an API key into a chat.

## The skill

The agent skill lives in `skills/jev-writer/` and is installed with:

```bash
npx skills add Kaos599/jev-writer --skill jev-writer
```

The full URL form works too and installs the same skill. If you change the skill,
change `SKILL.md` and its reference files together: anything too long for the
skill body belongs in `skills/jev-writer/references/`, and `SKILL.md` should
point at it rather than repeat it.

## Branching, Release, and PR Procedure

All code and documentation changes must follow this strict promotion procedure:

1. **Commit to a dedicated feature branch**: Never commit directly to `dev` or `main`.
2. **Open a PR into `dev` and check CI**: Create a PR targeting `dev`, watch CI runs (`CI/test` on Node 20 and 22, plus pack validation), and verify all checks pass.
3. **Merge into `dev`**: Once CI passes and changes are verified, merge the PR into `dev`.
4. **Promote from `dev` to `main` via PR**: Open a PR from `dev` into `main`, verify all file changes contain zero personal or private data, confirm all CI checks pass on `main`, and merge.

## Before you open a PR

```bash
npm test                  # node:test, 72 tests, all must pass
node src/cli.mjs doctor   # validates every pack and makes one live call
```

CI runs the suite on Node 20 and 22 and separately validates every rubric pack
without a key. `doctor` is deliberately not run in CI: it needs a provider key
and exits 1 without one, so a green tick there would only ever prove that a
repository secret exists. Run it locally before you open the PR.

Add a test for any new statistic or pack-validation rule. Several existing tests
exist because they caught a real bug; read them before changing behaviour they
pin.
