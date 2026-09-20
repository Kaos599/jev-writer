<div align="center">

# jev-writer

**Find out which qualities of your writing actually predict engagement.**

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Node](https://img.shields.io/badge/node-%3E%3D20-brightgreen.svg)](package.json)
[![Tests](https://img.shields.io/badge/tests-27%20passing-brightgreen.svg)](test/)

</div>

---

jev-writer rates every post you have published against a pre-registered rubric, then tests those ratings against your real engagement data. It reports what it finds in plain language, and it withholds conclusions when your sample is too small to support them.

It analyses posts. It does not write them.

```bash
npx jev-writer doctor          # check your key and packs, make one live call
npx jev-writer run ./exports   # build corpus, rate it, analyse it
```

Works with LinkedIn exports today, and with any platform you write a rubric pack for. Bring a Vercel AI Gateway, OpenRouter, or TypeSafe key.

---

## Contents

- [What problem this solves](#what-problem-this-solves)
- [How this differs from asking an LLM to rate your posts](#how-this-differs-from-asking-an-llm-to-rate-your-posts)
- [How it avoids telling you what you want to hear](#how-it-avoids-telling-you-what-you-want-to-hear)
- [Which outcome it optimises for](#which-outcome-it-optimises-for)
- [Providers and keys](#providers-and-keys)
- [What it costs to run](#what-it-costs-to-run)
- [Getting started](#getting-started)
- [Writing your own rubric pack](#writing-your-own-rubric-pack)
- [Using it from an agent](#using-it-from-an-agent)
- [Known limits](#known-limits)
- [FAQ](#faq)

---

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

**Confound control.** Every headline result is re-tested as a partial correlation controlling for publication date. A rated dimension and an outcome that both drift over time will correlate for no reason.

**Code features compete.** Character count, emoji, hashtags, and posting cadence are computed exactly and ranked alongside the model's judgments. If raw length beats your rubric, you find out.

## Which outcome it optimises for

Two, kept deliberately separate, because they answer different questions.

| Outcome | Formula | Question it answers |
|---|---|---|
| **Reach rate** | impressions ÷ followers at post time | Did the platform distribute this? |
| **Conversion rate** | engagements ÷ impressions | Given that people saw it, did the writing work? |

Conversion rate is the cleaner test of craft. It is unconfounded by follower count, posting time, and algorithmic luck. Most analytics tools report raw reactions, which mostly measures reach. A post seen by 800 people that earned 60 engagements tells you more about your writing than one seen by 5,000 that earned 90.

Follower count at post time is reconstructed from the daily follower sheet in LinkedIn's own analytics export, so reach rate is a real ratio rather than a raw count compared across years of audience growth.

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

## Getting started

**1. Export your data.** On LinkedIn you need both of these:

| Export | Path | Contains |
|---|---|---|
| Data archive | Settings → Data Privacy → Get a copy of your data → **larger archive** | post text, dates, URLs |
| Post analytics | Creator Mode → Analytics & Tools → Post analytics → Export | impressions, reactions, comments |

The basic archive contains no `Shares_*.csv` at all, which is the single most common setup failure. Request the larger one first, since it takes hours. Put both files in one directory.

**2. Get a key.** Any provider from the table above.

**3. Run it.**

```bash
export AI_GATEWAY_API_KEY=...
npx jev-writer doctor
npx jev-writer run ./exports
```

`doctor` verifies Node, your key, the pack, and makes one live call before a full run spends anything.

Output lands in `jev-writer-out/`. The file you want is `report.json`: grades, bands, plain-language findings, and a writing prompt generated from your own results.

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

## Using it from an agent

The repo ships an agent skill for Claude Code, Codex, and other agent environments. It walks a user through exporting their data, obtaining a key, running the pipeline, building a dashboard, and reading the result without overstating it.

```bash
npx skills add https://github.com/Kaos599/jev-writer --skill jev-writer
```

Reference files cover [providers](skills/jev-writer/references/providers.md), [platform exports](skills/jev-writer/references/platform-exports.md), [interpreting results](skills/jev-writer/references/interpreting-results.md), [dashboard design](skills/jev-writer/references/dashboard-design.md), and [rubric authoring](skills/jev-writer/references/rubric-authoring.md).

## Known limits

Stated plainly, because a tool that hides these is worse than no tool.

- **Correlation is not causation.** Posting time, follower composition, and platform ranking changes are unmeasured confounders.
- **LinkedIn caps engagement history.** The analytics export covers roughly 12 months and the top 50 posts. Older engagement is not recoverable by any method, including by LinkedIn.
- **Impressions are author-only.** No third-party API can supply them at any price. They are rendered only into the authenticated author's own session.
- **Jev is calibrated, not correct.** Typed output guarantees the interface, not the truth. Validate rubrics against your own labelled examples before trusting them.
- **Score magnitudes are ordinal.** TypeSafe warns against interpolating between levels, which is why every correlation here is Spearman rank rather than Pearson.

## FAQ

**Does this work for platforms other than LinkedIn?**
Yes. The statistics and the rubric format are platform-agnostic. You need an adapter producing items with text and an outcome, plus a rubric pack. LinkedIn ships in the box, and `references/platform-exports.md` documents what is recoverable from X, Medium, Substack, YouTube, Reddit, and Instagram.

**Do I need a TypeSafe account?**
No. TypeSafe operated a waitlist at launch. The AI Gateway and OpenRouter providers reach the same model without one.

**Does my writing get used for training?**
Zero Data Retention is requested on every AI Gateway call. Check your provider's terms, since this tool sends your content to a third party and cannot make guarantees on their behalf.

**Why does it refuse to give me findings?**
Because you have fewer than 25 posts with outcome data. At that size, correlations are dominated by noise and any confident answer would be fabricated. Descriptive statistics are still shown.

**Can I use a normal LLM instead of Jev?**
Partly. The AI SDK's `evaluate` works with OpenAI, Anthropic, and Google models through an adapter, but those do not return calibrated probability distributions, so the rubric-health check and the confidence gating stop working.

## Contributing

New rubric packs and platform adapters are the most useful contributions. Packs must declare their pre-registration tiers and pass `validatePack`. See [AGENTS.md](AGENTS.md) for conventions and the traps worth knowing about.

```bash
npm test                  # 27 tests
node src/cli.mjs doctor   # validates every pack, makes one live call
```

## License

MIT
