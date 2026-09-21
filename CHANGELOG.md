# Changelog

Notable changes to jev-writer. Format loosely follows [Keep a Changelog](https://keepachangelog.com/).

## [Unreleased]

### Added
- Enhanced dashboard presentation with shadcn/ui-inspired tokens, dark/light theme toggle, and refined typographic hierarchy.
- Interactive **Advanced view** toggle and detailed statistical diagnostic table in `#methods`.
- High-fidelity SVG breakdown diagnostics for post formats, opening hook archetypes, and media types with visible sample sizes ($n$) and observational caveats.
- Content & Audience Performance observation cards in the dashboard.
- Format filter dropdown in the post explorer.
- `skills/jev-writer/references/components.md` specifying a 3-tier progressive component architecture (Tier 1 text-only to Tier 3 full outcomes) for AI coding agents.
- `CLAUDE.md` providing comprehensive guidelines for Claude Code agents.
- SEO, GEO, and AEO optimization for `README.md` including direct Q&A schemas and project roadmap.
- `jev-writer dashboard` renders `report.json` as one self-contained HTML page: inline CSS and JS, data embedded, no CDN and no build step, so it opens over `file://`. Exposed as `buildDashboard()` for programmatic use.
- `corpus` facts on the report: posting volume by year, follower trajectory, and headline medians.
- A derived posting-cadence classification, so the dashboard writes a true sentence about your volume instead of a templated one.
- An `exports` map for library consumers, making `jev-writer/rubrics/pack.mjs`, `jev-writer/stats.mjs`, `jev-writer/report.mjs`, `jev-writer/dashboard.mjs` and `jev-writer/adapters/linkedin.mjs` the stable public surface.
- Question groups on the LinkedIn pack, covering all 30 questions across 5 families. Presentation only.
- CI on Node 20 and 22, plus a smoke job validating every rubric pack without a key.
- Tests for `report.mjs` and `dashboard.mjs`, growing suite to 72 passing tests.
- `CONTRIBUTING.md`, `SECURITY.md`, and this file.

### Fixed
- **The dashboard reported "0.0% reach" when there was no engagement data at all.** `null * 100` is `0` in JavaScript, so the percentage formatter turned "we cannot measure this" into a confident claim of zero reach, on the hero card, whenever no analytics export was supplied. It now reads "No data".
- Benjamini-Hochberg corrected over the dimensions that could actually be tested while the power headline announced dimensions times outcomes. Where outcome coverage is thin the two diverge. The family size is now computed once and the number announced is the number corrected over.
- `cadenceOf` picked the peak year with a strict `>`, so an author whose latest year tied their best year was told they were publishing less.
- `buildDashboard` threw an opaque `TypeError` on a `report.json` written before the corpus fields existed. It now names the stale file and the command to re-run.
- **The date-control gate was silently corrupted.** `control.slice(0, pairs.length)` took the first n publication dates rather than the dates of the n surviving items, so a single post missing a rating misaligned every date after it. This is the mechanism that decides whether a finding is confirmed or dismissed as time drift. Values, outcomes and dates now travel as one tuple through a single filter, making the misalignment unrepresentable.
- **Zero engagements were treated as missing data.** `impressions && engagements ? ... : null` dropped any post with no engagement from every correlation, which systematically excluded the worst-performing posts and biased every finding upward. Only a zero denominator now yields null.
- Same-date collisions left media type and media count attributed to a pooled guess while correctly nulling metrics. All per-post fields are now null on a colliding date.
- Rows with unparseable dates were dropped in four places without a word. They are now counted and reported, with sample values, in `warnings`.
- The follower back-walk assumed the export's headline total aligned with the last daily row, unvalidated. A mismatch or a moved sheet layout now nulls follower-derived fields rather than biasing every reach rate.
- Posts published before the follower window received the earliest known follower count. They now receive none.
- The permutation seed is overridable and reported, rather than a hardcoded default no caller could reach.
- `.gitignore` missed `jev-out/report.json`, the one output containing every post in full.
- The lockfile still carried the pre-rename package name.

### Changed
- The dashboard's narrative is derived from the data rather than hardcoded. An earlier version's heading asserted that the author had stopped posting, which was true of exactly one corpus.
- Methods text derives its question counts from the pack instead of hardcoding them.
- Platform names are parameterised rather than assuming LinkedIn.

## [0.1.0]

Initial public release: providers, statistics, rubric packs, the LinkedIn adapter, the report layer, and the agent skill.
