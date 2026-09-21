<div align="center">

# jev-writer

**Find out which qualities of your writing actually predict engagement.**

[![CI](https://github.com/Kaos599/jev-writer/actions/workflows/ci.yml/badge.svg)](https://github.com/Kaos599/jev-writer/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Node](https://img.shields.io/badge/node-%3E%3D20-brightgreen.svg)](package.json)
[![Tests](https://img.shields.io/badge/tests-72%20passing-brightgreen.svg)](test/)

</div>

---

**jev-writer** is an open-source content analytics engine and LLM-as-a-judge evaluation harness. It rates published posts against pre-registered writing rubrics using calibrated probabilities from Jev (TypeSafe AI's System One model), then tests those ratings against real engagement outcomes (impressions, reach rate, conversion rate).

Unlike generative writing assistants that flatter drafts, jev-writer enforces strict statistical safeguards: an observational power gate, date-confound controls, and Benjamini-Hochberg false-discovery corrections. It reports what it finds in plain English and refuses to state findings when sample sizes cannot support them.

**It analyses posts. It does not write them.**

Install it as an agent skill and ask your coding agent to audit and analyze your writing:

```bash
npx skills add Kaos599/jev-writer --skill jev-writer
```

The skill walks you through exporting your data, getting a key, running the pipeline, and reading the result without overstating it. Or drive the CLI yourself:

```bash
npx github:Kaos599/jev-writer doctor          # check your key, make one live call
npx github:Kaos599/jev-writer run ./exports   # build, rate, analyse, render
```

Works with LinkedIn exports today, and with any platform you write a rubric pack for. Bring a Vercel AI Gateway, OpenRouter, or TypeSafe key.

### Writing Better Content with Agent Skills

It is recommended to use GenAI coding agents with specialized writing skills to eliminate synthetic AI tells and author grounded technical prose. You can install the companion professional writing skills package ([`Kaos599/professional-skills`](https://github.com/Kaos599/professional-skills)) with:

```bash
npx skills add Kaos599/professional-skills
```

This equips your agent with `technical-content-writer` and `anti-slop-writing` to write higher-clarity technical content in correspondence and at work, pairing directly with `jev-writer`'s calibrated pre-flight audits.

---

## Contents

- [What you can do with it](#what-you-can-do-with-it)
- [Features](#features)
- [Getting started](#getting-started)
- [What problem this solves](#what-problem-this-solves)
- [How this differs from asking an LLM to rate your posts](#how-this-differs-from-asking-an-llm-to-rate-your-posts)
- [How it avoids telling you what you want to hear](#how-it-avoids-telling-you-what-you-want-to-hear)
- [Which outcome it optimises for](#which-outcome-it-optimises-for)
- [The dashboard](#the-dashboard)
- [The writing prompt](#the-writing-prompt)
- [Providers and keys](#providers-and-keys)
- [What it costs to run](#what-it-costs-to-run)
- [Writing your own rubric pack](#writing-your-own-rubric-pack)
- [Using it from an agent](#using-it-from-an-agent)
- [Known limits](#known-limits)
- [FAQ](#faq)

---

## What you can do with it

Six things people actually use this for. Each one names the command that does it.

**Find out which of your own writing habits predicted engagement.** The core loop. Thirty judgments per post, correlated against your real numbers, with everything that fails correction thrown away. `jev-writer run ./exports`

**Get a review prompt built from your own results.** The tool writes a prompt naming the dimensions that predicted engagement *for you* and the ones you are habitually weakest on. Paste it into any assistant before you publish. It is not "write a better hook"; it is your results. `jev-writer analyze`, then read `writingPrompt` in `jev-out/report.json`.

**See where every post stands without reading a statistic.** One self-contained HTML page: each post graded, each judgment shown as a coloured band, sortable and searchable. `jev-writer dashboard`

**Audit a rubric before you trust it.** Packs are plain files. Change a level description, re-run, and see whether the finding survives. A full pass on 178 posts cost about $0.31, which is what makes this practical rather than theoretical.

**Check whether an AI-judge pipeline you already run is measuring anything.** The statistics module stands alone. Feed it your own judge scores and your own outcomes and it will tell you how much survives date control and false-discovery correction. `import { testDimension } from 'jev-writer/stats.mjs'`

**Score a platform this repo has never seen.** Write an adapter that emits items with text and an outcome, write a pack, and the entire pipeline applies. Newsletters, video titles, docs pages, cold email.

Who this is for: people publishing regularly enough to have 25 or more posts with engagement data, who want to know whether their instincts about their own writing are real. Below that threshold the tool will tell you it cannot know, which is the point.

## Features

| | |
|---|---|
| **Calibrated judgments** | Ratings come from [Jev](https://typesafe.ai), a System One model returning probability distributions over levels you define, not generated text parsed into a number. |
| **Pre-registration** | Every question is tagged `primary` or `exploratory` in a file that lives in git, so the commit timestamp proves the commitment preceded the result. |
| **Power gate** | Under 25 posts with outcome data, correlations are refused outright. Between 25 and 60 the tool reports the smallest effect your sample can detect. |
| **False-discovery correction** | Benjamini-Hochberg across every test run, not just the ones that looked good. The family size is the number of tests actually performed, and the same number is what the tool reports to you. |
| **Confound control** | Every result is re-tested as a partial correlation controlling for publication date, and the correction runs on the controlled p-value. |
| **Direction of merit** | Each dimension declares `higher_is_better`, `lower_is_better`, or `neutral`, so a low score where low is good paints green. 13, 7 and 4 of them respectively in the shipped pack. |
| **Code features compete** | Character count, emoji, hashtags, sentence length and posting cadence are computed exactly and ranked against the model's judgments in the `analyze` table. If raw length beats your rubric, you find out. |
| **Self-contained dashboard** | One HTML file, no CDN, no build step, no network. Opens over `file://`. |
| **Generated writing prompt** | A paste-ready review prompt derived from your own validated findings. |
| **Portable rubric packs** | One pack, three provider dialects, translated at the boundary. |
| **Zero-dependency parsing** | CSV, ZIP and XLSX readers are written against the stdlib. The only runtime dependency is `ai`. |
| **Agent skill included** | A skill for Claude Code, Codex and similar, with five reference files. |
| **67 tests** | `node --test`, no assertion library, no network. |

## Getting started

### 1. Export your data

On LinkedIn you need **both** of these. They are different exports and neither contains the other.

| Export | Where | Contains |
|---|---|---|
| Data archive | Settings → Data Privacy → Get a copy of your data → **the larger archive** | post text, dates, URLs |
| Post analytics | Analytics & Tools → Post analytics → Export | impressions, reactions, comments, daily followers |

The basic archive contains no `Shares_*.csv` at all, which is the single most common setup failure. Request the larger one first; it takes hours to arrive. Put both files, still zipped, in one directory.

Other platforms are documented in [`references/platform-exports.md`](skills/jev-writer/references/platform-exports.md).

### 2. Get a key

Any one of three providers works. Full instructions per provider in [`references/providers.md`](skills/jev-writer/references/providers.md).

```bash
export AI_GATEWAY_API_KEY=...     # or OPENROUTER_API_KEY, or TYPESAFE_API_KEY
```

Set exactly one. The tool detects which and translates the rubric into that provider's dialect.

### 3. Run it

```bash
npx github:Kaos599/jev-writer doctor
npx github:Kaos599/jev-writer run ./exports
```

Or from a clone, which is what you want if you plan to edit a rubric:

```bash
git clone https://github.com/Kaos599/jev-writer && cd jev-writer
npm install
node src/cli.mjs doctor
node src/cli.mjs run ./exports
```

`doctor` checks Node, your key, every rubric pack, and makes one live call before a full run spends anything.

### 4. Read the output

Everything lands in `jev-out/` (override with `JEV_WRITER_OUT`).

| File | What it is |
|---|---|
| `corpus.jsonl` | your posts, joined to their metrics, with code features computed |
| `ratings.jsonl` | raw judgments, appended as they arrive so a run resumes after an interruption |
| `report.json` | grades, bands, plain-language findings, weak spots, and the writing prompt |
| `dashboard.html` | the whole report as one page |

```bash
open jev-out/dashboard.html
```

`jev-out/` is gitignored. Both `report.json` and `dashboard.html` embed the full text of every post, so keep them out of commits.

### Commands

| Command | What it does |
|---|---|
| `doctor` | check Node, keys, packs; one live call |
| `build <dir>` | parse exports into `corpus.jsonl` |
| `rate` | rate the corpus, resumable |
| `analyze` | correlate against outcomes, write `report.json` |
| `dashboard` | render `report.json` to `dashboard.html` |
| `run <dir>` | build, rate, analyze, dashboard |

## What problem this solves

Most tools that rate your content ask a language model to score a post from 1 to 10, then present whatever comes back as insight.

Three things go wrong. The score is a generated token rather than a measured quantity, so it carries no calibrated uncertainty. Nothing is ever checked against what actually happened to the post. And scoring twenty dimensions against two outcomes runs forty significance tests, of which roughly two will look meaningful on pure noise. The result is a tool that produces a confident story whether or not one exists.

jev-writer inverts all three. Judgments come from a model that returns probability distributions natively. Every judgment is tested against your real engagement data. The statistics are adversarial toward their own conclusions.

## How this differs from asking an LLM to rate your posts

A language model generates a score as text. [Jev](https://typesafe.ai) returns a probability distribution over levels you define. That difference is what makes validation possible.

When Jev is genuinely torn between "creates curiosity" and "hard to scroll past", it returns 0.49/0.51 with a confidence of 0.51, and repeated calls agree to within about 0.03. The uncertainty lives in the distribution rather than in the sampling, so you can distinguish a model that is unsure from a rubric that is broken.

That enables a check no prompt-and-parse pipeline can perform. If a dimension's confidence sits near 0.5 across your whole corpus, its levels do not discriminate, and the tool says so instead of reporting the number.

## How it avoids telling you what you want to hear

Four mechanisms, each of which can cost you a finding.

**Pre-registration.** Every question in a pack is tagged `primary` or `exploratory` in the rubric file. Packs live in git, so the commit timestamp proves the commitment preceded the result. Exploratory correlations are computed and shown dimmed, labelled as hypotheses, never as findings.

**A power gate.** Below 25 posts with outcome data, the tool computes descriptive statistics and refuses to correlate at all. Between 25 and 60 it reports the minimum effect your sample can detect, and how many "significant" results to expect by chance.

**Confound control.** Every headline result is re-tested as a partial correlation controlling for publication date. A rated dimension and an outcome that both drift over time will correlate for no reason. The false-discovery correction then runs on the controlled p-value, not the raw one.

**Code features compete.** Character count, emoji, hashtags, sentence length, and posting cadence are computed exactly and ranked alongside the model's judgments, so a rubric that is merely restating post length is visible as such.

One scope note, because it matters: those code features appear in the `analyze` terminal table, which is where you compare them against your rubric. `report.json` and the dashboard cover the rubric dimensions only. The two therefore correct over different families and can disagree about which dimensions clear the threshold. Read the table when you are auditing a rubric, and the dashboard when you are reading results.

What this looks like in practice, on this project's own corpus. 178 posts, 43 of them carrying reach data, 41 carrying conversion data. The shipped pack rates 24 dimensions, so 24 tests per outcome and 48 in total, of which about 1.2 per outcome are expected to clear p < 0.05 on noise alone.

Ten relationships cleared it. **One** survived Benjamini-Hochberg, and that one was tagged exploratory, so the tool declined to promote it to a finding and reported a confirmed-findings count of zero.

Correction runs within each outcome, on the date-controlled p-value rather than the raw one, and the number of tests the tool announces is the number it actually corrected over. A dimension with too little paired data to test is not counted as a test that the correction survived.

## Which outcome it optimises for

Two, kept deliberately separate, because they answer different questions.

| Outcome | Formula | Question it answers |
|---|---|---|
| **Reach rate** | impressions ÷ followers at post time | Did the platform distribute this? |
| **Conversion rate** | engagements ÷ impressions | Given that people saw it, did the writing work? |

Conversion rate is the cleaner test of craft. It is unconfounded by follower count, posting time, and algorithmic luck. Most analytics tools report raw reactions, which mostly measures reach. A post seen by 800 people that earned 60 engagements tells you more about your writing than one seen by 5,000 that earned 90.

Follower count at post time is reconstructed from the daily follower sheet in LinkedIn's own analytics export, so reach rate is a real ratio rather than a raw count compared across years of audience growth. The reconstruction is validated against the export's headline total; if they disagree, follower-derived fields are nulled rather than guessed.

## The dashboard

```bash
jev-writer dashboard && open jev-out/dashboard.html
```

One HTML file. Inline CSS, inline JS, data embedded, no CDN and no fetch, so it opens on a laptop with no network. A 178-post corpus renders to about 600 KB.

The presentation rules are the reason it exists. An earlier version showed rank correlations and p-values and was correctly described by its first reader as unreadable. So: no statistics vocabulary anywhere except one collapsed methods section, every judgment shown as a coloured band rather than a number, bands arriving direction-aware from the report so a low score on a dimension where low is good still paints green, and charts only where a chart genuinely says something.

Every narrative sentence is derived from your data rather than templated. If your posting volume grew, it says so; the heading is not fixed in advance.

## The writing prompt

`report.json` carries a `writingPrompt` built from your own results: the dimensions that predicted engagement for you, what each one means, the level to aim for, and the gap between your typical post and your best ones. Paste it above a draft in any assistant.

It is `null` when nothing survived validation. A prompt generated from no findings would be generic advice wearing your data as a costume.

## Providers and keys

Any one of three. The tool auto-detects whichever key is present and translates the rubric pack into that provider's dialect.

| Provider | Env var | Model | Notes |
|---|---|---|---|
| Vercel AI Gateway | `AI_GATEWAY_API_KEY` | `typesafe-ai/jev` | Needs `ai` ≥ 7.0.105. Evaluation is exposed only through the AI SDK, not the gateway's OpenAI-compatible endpoints. |
| OpenRouter | `OPENROUTER_API_KEY` | `~typesafe/jev-latest` | Dedicated Decisions API at `/api/alpha/decisions`. |
| TypeSafe direct | `TYPESAFE_API_KEY` | `jev-latest` | `POST /v1/systemone`. Account required. |

The dialects genuinely differ. The AI SDK calls a yes/no question `boolean` and returns `{probability}`, while OpenRouter and TypeSafe call it `noul` and return `{noul}`. Packs are authored once and stay portable across all three.

## What it costs to run

Jev is priced at **$0.042 per million input tokens, with output tokens free**. Rating 178 posts at five repetitions each (890 calls, roughly 7.4M input tokens) came to about **$0.31** at list price.

That matters for method rather than budget. Because a full pass is nearly free, you can rewrite the rubric and re-run twenty times while tuning the level descriptions, which is where the quality of this analysis actually lives.

> Check current pricing before a large run. TypeSafe launched in September 2026 and pricing is still moving.

## Writing your own rubric pack

A pack is a versioned set of typed questions plus the fields each question may see. LinkedIn is one pack. Newsletters, video titles, documentation, and cold email are ordinary user-space files.

```js
import { score, bool } from 'jev-writer/rubrics/pack.mjs';

export default {
  id: 'newsletter',
  version: '1.0.0',
  description: 'Rates newsletter issues on opening strength and payoff.',
  stateFields: ['subject_line', 'body'],
  outcomes: { open_rate: 'opens / delivered', click_rate: 'clicks / opens' },
  questions: {
    subject_curiosity: score('primary', {
      question: 'How strongly does `subject_line` make a subscriber open this email?',
      note: 'Judge only `subject_line`. Ignore whether `body` delivers.',
    }, [
      { summary: 'No reason to open', signals: ['Describes the topic without a claim'] },
      { summary: 'Mildly interesting', signals: ['A familiar framing'] },
      { summary: 'Creates real curiosity', signals: ['A specific number or tension'] },
      { summary: 'Hard to ignore', signals: ['Stakes the reader feels personally'] },
    ]),
    has_evidence: bool('primary', 'Does `body` report a result the author personally observed?'),
  },
};
```

`validatePack` runs before a single call is spent. It rejects score questions outside 2 to 10 levels, choice questions with no no-match option, unknown tiers, and instructions referencing state the pack never declared.

Two rules when authoring:

**Never ask the model anything code can count.** Length, emoji, hashtags, and cadence are computed exactly and compete with the judgments on equal footing.

**Rubric wording is load-bearing.** During development, tightening one clause in a single question moved its probability from **0.99 to 0.71 on identical input**. `jev-1.13` reads instructions literally, as documented on TypeSafe's [model jaggedness page](https://docs.typesafe.ai/model-jaggedness/jev-1.13). Treat pack edits as breaking changes: bump the version and re-rate rather than pooling ratings across wordings.

Full guidance in [`references/rubric-authoring.md`](skills/jev-writer/references/rubric-authoring.md).

## Using it from an agent

The repo ships an agent skill for Claude Code, Codex, and other agent environments. It walks a user through exporting their data, obtaining a key, running the pipeline, opening the dashboard, and reading the result without overstating it.

```bash
npx skills add Kaos599/jev-writer --skill jev-writer
```

The full URL form works too, and installs the same skill:

```bash
npx skills add https://github.com/Kaos599/jev-writer --skill jev-writer
```

Or install it by hand, which is just a file copy:

```bash
git clone https://github.com/Kaos599/jev-writer
cp -r jev-writer/skills/jev-writer ~/.claude/skills/
```

Then ask your agent to analyse your writing, and it will pick the skill up.

Reference files cover [providers](skills/jev-writer/references/providers.md), [platform exports](skills/jev-writer/references/platform-exports.md), [interpreting results](skills/jev-writer/references/interpreting-results.md), [dashboard design](skills/jev-writer/references/dashboard-design.md), and [rubric authoring](skills/jev-writer/references/rubric-authoring.md).

## Known limits

Stated plainly, because a tool that hides these is worse than no tool.

- **Correlation is not causation.** Posting time, follower composition, and platform ranking changes are unmeasured confounders.
- **LinkedIn caps engagement history.** The analytics export covers roughly 12 months and the top 50 posts. Older engagement is not recoverable by any method, including by LinkedIn.
- **Impressions are author-only.** No third-party API can supply them at any price. They are rendered only into the authenticated author's own session.
- **Jev is calibrated, not correct.** Typed output guarantees the interface, not the truth. Validate rubrics against your own labelled examples before trusting them.
- **Score magnitudes are ordinal.** TypeSafe warns against interpolating between levels, which is why every correlation here is Spearman rank rather than Pearson.
- **Two posts on the same day cannot be told apart.** The analytics export joins on date. When two posts share one, metrics, post URL and media are all left null rather than guessed.

## Frequently Asked Questions (FAQ)

### How does jev-writer prevent false correlations?
jev-writer enforces three mathematical safeguards:
1. **The Power Gate:** With fewer than 25 posts with outcome data, correlations are refused entirely. Between 25 and 60 posts, minimum detectable effect sizes are reported with prominent sample size warnings.
2. **Date-Confound Residualization:** It computes partial Spearman rank correlations controlling for post publication date, preventing time drift from masquerading as writing quality findings.
3. **Benjamini-Hochberg Correction:** False-discovery rate (FDR) control is calculated across all tests run, testing against date-controlled permutation p-values.

### Can jev-writer rewrite or draft my posts?
No. Jev is a System One model calibrated for categorical evaluation and probability estimation, not conversational drafting. jev-writer analyzes existing posts and produces a targeted review prompt for drafting assistants.

### What does it cost to evaluate a library of posts?
Jev is priced at $0.042 per million input tokens with output free. Evaluating a typical 100-post library across 30 questions at 5 repetitions consumes approximately 4–5M tokens (~$0.20 total).

### How does jev-writer adapt to platforms with sparse data?
jev-writer uses a 3-tier progressive component architecture (detailed in `skills/jev-writer/references/components.md`):
- **Tier 1 (Text Only, e.g. Medium):** Rubric audits, AI-feel distributions, writing style diagnoses, and the generated writing prompt.
- **Tier 2 (Text + Cadence, e.g. Substack):** Adds posting volume, cadence velocity, and style evolution over time.
- **Tier 3 (Full Text + Outcomes, e.g. LinkedIn):** Outcome metrics, reach vs conversion comparisons, format/hook breakdown matrices, and statistical diagnostic tables.

### Does this work for platforms other than LinkedIn?
Yes. The statistics and rubric specifications are platform-agnostic. You need an adapter producing items with text and an outcome, plus a rubric pack. LinkedIn ships in the box, and `skills/jev-writer/references/platform-exports.md` documents what is exportable from X, Medium, Substack, YouTube, Reddit, and Instagram.

### Do I need a TypeSafe account?
No. Vercel AI Gateway and OpenRouter provide access to the same calibrated Jev model without a TypeSafe console account.

### Does my writing get used for model training?
Zero Data Retention is requested on every AI Gateway call. Check your chosen provider's terms; jev-writer sends content only to your selected provider.

## Roadmap & Tasks

- [x] Pre-registered rubric pack format and validation (`src/rubrics/pack.mjs`)
- [x] Spearman rank, permutation tests, and Benjamini-Hochberg FDR (`src/stats.mjs`)
- [x] Confound control for publication date drift
- [x] Zero-dependency CSV/XLSX parser for LinkedIn archives
- [x] Multi-provider support (AI Gateway, OpenRouter, TypeSafe direct)
- [x] High-fidelity self-contained dashboard with SVG charting and dark/light modes
- [x] Format and hook archetype breakdown diagnostics with visible sample sizes ($n$)
- [x] Component-first architecture and progressive enhancement across Tiers 1-3 (`skills/jev-writer/references/components.md`)
- [x] Comprehensive agent skill with 6 reference guides
- [ ] Native adapters for X/Twitter and Substack archives
- [ ] User custom configuration file for pack overrides
- [ ] SQLite persistence layer for historical runs

## Contributing

New rubric packs and platform adapters are the most useful contributions. Packs must declare their pre-registration tiers and pass `validatePack`. See [AGENTS.md](AGENTS.md) and [CLAUDE.md](CLAUDE.md) for conventions and traps worth knowing about.

```bash
npm test                  # 72 tests passing
node src/cli.mjs doctor   # validates every pack, makes one live call
```

## License

MIT

