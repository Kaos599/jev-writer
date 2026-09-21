# CLAUDE.md

Guidelines for Claude Code and coding agents working in this repository.

## What this project is

A tool that discovers which qualities of a person's writing actually predict
engagement, by rating their published posts with Jev (TypeSafe AI's System One
model) and testing those ratings against their real engagement data.

**It analyses posts. It does not write them.** Jev is not trained to generate
text. If you are asked to add a drafting or rewriting feature, explain that the
underlying model cannot do it and propose the analysis-side equivalent.

## The one rule that governs everything

**This tool's value is that it refuses to flatter.** Dozens of products already
tell people their content is great. Every design decision here trades
persuasiveness for honesty, and reviewers should reject changes that reverse
that trade.

Concretely, do not:
- report an exploratory correlation as a finding,
- remove or weaken the power gate ($n < 25$ reports nothing; $25 \le n < 60$ carries explicit caveats),
- present a number whose uncertainty is not also presented,
- let a rubric see the outcome it is meant to predict,
- soften a null result into a hedge,
- present small-sample categorical slices ($n < 10$) as proven rules.

If a change makes the output more impressive and less defensible, it is wrong.

## Project Structure

```
src/stats.mjs            rank correlation, permutation tests, the power gate
src/report.mjs           the statistics -> English boundary. Read this first.
src/dashboard.mjs        buildReport output -> one self-contained HTML string
src/index.mjs            library entry point, re-exporting the stable surface
src/rubrics/pack.mjs     pack format and validation
src/rubrics/*.mjs        shipped packs, each with its own `directions` export
src/adapters/*.mjs       platform export parsing
src/providers/*.mjs      one file per transport (gateway, openrouter, typesafe)
src/cli.mjs              doctor / build / rate / analyze / dashboard / run
skills/jev-writer/       the agent skill and its reference files
skills/jev-writer/references/
  components.md          component-first UI architecture and progressive tiers 1-3
  dashboard-design.md    dashboard specification, layout, and visual rules
  interpreting-results.md report.json field guide and honest reporting rules
  platform-exports.md    data export capabilities for LinkedIn, Medium, X, Substack, etc.
  providers.md           API keys, transports, and token pricing
  rubric-authoring.md    pack authoring, pre-registration tiers, and directions
test/                    node:test, no framework (72 tests)
.github/workflows/ci.yml CI workflow on Node 20 and 22
llms.txt                 machine-readable project summary
```

## Boundaries & Architecture

- **`src/report.mjs` is the statistics -> English boundary.** Everything above it speaks statistics; everything below it speaks English. No raw $p$-value, $\rho$, or confidence interval may cross that boundary onto a default user-facing surface.
- **`src/dashboard.mjs` does no I/O.** It receives the object returned by `buildReport()` and produces a self-contained HTML string with inline CSS/JS and embedded payload. Zero runtime network dependencies; opens locally over `file://`.
- **Advanced Mode in Dashboard:** Deeper statistical diagnostics (partial $\rho$, permutation $p$, sample size $n$, FDR $q$-values) are kept strictly inside the collapsible `<section id="methods">` to ensure no statistics vocabulary escapes onto the default body surface.
- **Multi-Tier Component Architecture:** Progressive enhancement from Tier 1 (Text-only qualitative audits, e.g. Medium) to Tier 2 (Cadence & velocity) to Tier 3 (Full outcomes & matrix breakdowns, e.g. LinkedIn). Documented in `skills/jev-writer/references/components.md`.

## Commands

```bash
# Run tests
node --test test/*.test.mjs

# Doctor check (Node, keys, pack validation, live call)
node src/cli.mjs doctor

# Full pipeline run
node src/cli.mjs run ./exports
```

## Branching, Release, and PR Procedure

All code and documentation changes follow this strict promotion workflow:

1. **Feature branch**: Make commits to a dedicated feature branch (never directly to `dev` or `main`).
2. **PR into `dev` & CI verification**: Open a PR targeting `dev`, watch CI (`CI/test` on Node 20 and 22, pack validation), and ensure all checks pass.
3. **Merge into `dev`**: Once CI passes and changes are verified, merge the PR into `dev`.
4. **Promote from `dev` to `main` via PR**: Open a PR from `dev` into `main`, verify all changes contain zero personal or private data, confirm all CI checks pass on `main`, and merge.

## Conventions

- **ESM only**, Node >= 20, no TypeScript, no build step.
- **One runtime dependency** (`ai`, required by the AI Gateway evaluation path). Do not add dependencies.
- **Public API surface:** The `exports` field in `package.json` defines all public entry points.
- **Comments explain why, not what.**
- **Synthetic fixtures in tests:** Never commit real user posts or engagement data to the repository.
- **Privacy:** `jev-out/`, `data/`, `out/`, `*.jsonl`, `report.json`, and `dashboard.html` are strictly gitignored. Never ask users to paste API keys into chat.
