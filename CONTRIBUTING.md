# Contributing

New rubric packs and platform adapters are the most useful contributions. Everything here is plain ES modules on Node 20 or newer, with one runtime dependency.

## Setup

```bash
git clone https://github.com/Kaos599/jev-writer && cd jev-writer
npm install
npm test                  # 67 tests, no network, no key required
node src/cli.mjs doctor   # validates every pack and makes one live call
```

`doctor` is the only command that needs a provider key. CI never runs it, because a green tick that depends on a repository secret is one contributors cannot reproduce and forks cannot run at all.

## What makes a good contribution here

This project's whole claim is that it refuses to flatter its user. Contributions are judged against that first.

**A new rubric pack** must tag every question `primary` or `exploratory` before any result is seen, declare a direction of merit for each dimension, and pass `validatePack`. Ask the model nothing that code can count: length, emoji, hashtags and cadence are computed exactly and compete with the judgments on equal footing.

**A new platform adapter** must produce items carrying text, a date, and at least one outcome. Where a value cannot be attributed to a specific item, leave it null. Do not guess and do not carry a neighbour's value forward. If rows are dropped, count them and say so in `warnings`; a silent drop is worse than a loud failure because it looks like a small corpus rather than a broken parser.

**A statistics change** needs a test that fails without it. The module is small on purpose.

## Testing

```bash
npm test                          # everything
node --test test/report.test.mjs  # one file
```

Tests use `node:test` and `node:assert/strict` with no assertion library and no mocking framework. The adapter tests write real ZIP and XLSX files to temporary directories rather than mocking the readers, because the defects those tests exist to catch are hardcoded sheet offsets that a mock would happily preserve.

## Traps worth knowing before you start

These have each cost someone a day. [AGENTS.md](AGENTS.md) carries the full list.

- Bands are quintiles of the author's own distribution, so "share of posts in the bottom two bands" is 40% for every dimension by construction. It is not a measure of weakness.
- Rubric wording is load-bearing. Tightening one clause moved a probability from 0.99 to 0.71 on identical input. Treat a pack edit as a breaking change: bump the version and re-rate rather than pooling ratings across wordings.
- Score magnitudes are ordinal, not numeric. Every correlation is Spearman rank. Never Pearson.
- Parallel arrays built by two independent filters will drift apart. Carry the tuple through one filter instead.

## Pull requests

Branch from `dev`, not `main`. Keep commits logical rather than chronological. CI runs the suite on Node 20 and 22 plus a pack-validation smoke job; both must pass.

Commit messages use `type(scope): what changed`, written so someone reading `git log` a year from now learns something. Explain why in the body when the why is not obvious.

## Reporting a problem

Wrong numbers matter more than crashes here. If a finding looks wrong, open an issue with the shape of your corpus (post count, how many carry outcome data, date range) and the relevant part of `report.json`. Never attach `report.json` or `dashboard.html` themselves: both embed the full text of every post you have written.
