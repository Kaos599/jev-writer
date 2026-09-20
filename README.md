# jev-notetaker

**jev-notetaker finds which qualities of your writing actually predict engagement — and tells you when your sample is too small to know.** It rates every post you have written against a pre-registered rubric using [Jev](https://typesafe.ai), TypeSafe AI's System One model, then correlates those ratings against real outcomes with rank statistics, permutation tests and a power gate that withholds conclusions it cannot support. It works with LinkedIn exports today and any platform you write a rubric pack for. Bring an AI Gateway, OpenRouter or TypeSafe key.

```bash
npx jev-notetaker doctor          # check keys, packs, and make one live call
npx jev-notetaker run ./exports   # build corpus, rate it, analyse it
```

---

## What problem does this solve?

Most "AI rates your content" tools ask a language model to score a post from 1 to 10, then present whatever comes back as insight. Three things go wrong. The score is a generated token, not a measured quantity, so it carries no calibrated uncertainty. Nothing is ever checked against what actually happened to the post. And scoring twenty dimensions against two outcomes runs forty significance tests, of which roughly two will look meaningful on pure noise — so the tool reliably produces a confident story regardless of whether one exists.

jev-notetaker inverts all three. Judgments come from a model that returns probability distributions natively. Every judgment is tested against real engagement data. And the statistics are adversarial toward their own conclusions: pre-registration, false-discovery correction, and a refusal threshold.

## How is this different from asking ChatGPT to rate my posts?

A language model generates a score as text; Jev returns a probability distribution over levels you define. That difference is what makes validation possible. When Jev is genuinely torn between "creates curiosity" and "hard to scroll past", it returns 0.49/0.51 and a confidence of 0.51 — and repeated calls agree to within about 0.03. The uncertainty is in the distribution, not in the sampling, so you can tell a model that is unsure from a rubric that is broken.

That enables a check no prompt-and-parse pipeline can perform: if a dimension's confidence sits near 0.5 across your whole corpus, your rubric levels do not discriminate, and the tool says so instead of reporting the number.

## How does it avoid telling me what I want to hear?

Four mechanisms, each of which can cost you a finding:

- **Pre-registration.** Every question in a pack is tagged `primary` or `exploratory` in the rubric file. Because packs live in git, the commit timestamp proves the commitment preceded the result. Exploratory correlations are computed and displayed dimmed, labelled as hypotheses, never as findings.
- **A power gate.** Below 25 posts with outcome data, the tool computes descriptives and refuses to correlate at all. Between 25 and 60 it reports the minimum effect your sample can detect and how many "significant" results to expect by chance.
- **Confound control.** Every headline correlation is re-tested as a partial correlation controlling for publication date, because a rated dimension and an outcome that both drift over time will correlate for no reason.
- **Code features compete.** Character count, emoji, hashtags and posting cadence are computed exactly and ranked alongside the model's judgments. If raw length beats your rubric, you find out.

## Which outcome does it optimise for?

Two, kept deliberately separate, because they answer different questions. **Reach rate** is impressions divided by your follower count at the time of posting — did the platform distribute this? **Conversion rate** is engagements divided by impressions — given that people saw it, did the writing work?

Conversion rate is the cleaner test of craft: it is unconfounded by follower count, posting time and algorithmic luck. Most analytics tools report raw reactions, which mostly measures reach. A post seen by 800 people that earned 60 engagements tells you more about your writing than one seen by 5,000 that earned 90.

The follower count at post time is reconstructed from the daily follower sheet in LinkedIn's own analytics export, so reach rate is a real ratio rather than a raw count compared across years of audience growth.

## Which providers and keys work?

Any one of three. The tool auto-detects whichever key is present and translates the rubric pack into that provider's dialect.

| Provider | Env var | Model | Notes |
|---|---|---|---|
| Vercel AI Gateway | `AI_GATEWAY_API_KEY` | `typesafe-ai/jev` | Needs `ai` ≥ 7.0.105. Evaluation is exposed **only** through the AI SDK, not the gateway's OpenAI-compatible endpoints. |
| OpenRouter | `OPENROUTER_API_KEY` | `~typesafe/jev-latest` | Dedicated Decisions API at `/api/alpha/decisions`. |
| TypeSafe direct | `TYPESAFE_API_KEY` | `jev-latest` | `POST /v1/systemone`. Account required. |

The dialects genuinely differ: the AI SDK calls a yes/no question `boolean` and returns `{probability}`, while OpenRouter and TypeSafe call it `noul` and return `{noul}`. Packs are authored once and remain portable across all three.

## How much does it cost to run?

Jev is priced at $0.042 per million input tokens with output tokens free, so a full pass over a few hundred posts costs cents rather than dollars. Rating 178 posts at five repetitions each — 890 calls, roughly 7.4 million input tokens — came to about $0.31 at list price.

That matters for method, not budget. Because a full pass is nearly free, the rubric can be rewritten and re-run twenty times while you tune the level descriptions, which is where the quality of this kind of analysis actually lives. Check current pricing before a large run; TypeSafe launched in September 2026 and pricing is still moving.

## Why are the rubric level descriptions so long?

Because wording is load-bearing, and the effect is larger than intuition suggests. During development, tightening a single clause in one yes/no question — from "a specific number or result" to "a result the author personally observed" — moved its probability from **0.99 to 0.71 on identical input**.

`jev-1.13` reads instructions literally, which is documented on TypeSafe's own [model jaggedness page](https://docs.typesafe.ai/model-jaggedness/jev-1.13). It answers the question you wrote rather than the one you meant. So every Score level is an object with a concrete `summary` and observable `signals`, every Choice option carries `what` / `not_for` / `examples`, and edits to a pack are treated as breaking changes: ratings produced under different wordings are not comparable and should not be pooled.

## What are the known limits?

Stated plainly, because a tool that hides these is worse than no tool:

- **Correlation is not causation.** Confounders you have not measured — posting time, follower composition, platform ranking changes — are unobserved.
- **LinkedIn caps engagement history.** The analytics export covers roughly 12 months and the top 50 posts. Older engagement is not recoverable by any method, including by LinkedIn.
- **Impressions are author-only.** No third-party API can supply them at any price; they are rendered only into the authenticated author's own session.
- **Jev is calibrated, not correct.** Typed output guarantees the interface, not the truth. Validate rubrics against your own labelled examples before trusting them.
- **Score magnitudes are ordinal.** TypeSafe explicitly warns against interpolating between levels, which is why every correlation here is Spearman rank rather than Pearson.

## Getting started

**1. Export your data.** On LinkedIn: Settings → Data Privacy → Get a copy of your data → **the larger archive** (the basic archive contains no `Shares_*.csv` at all). Separately: Creator Mode → Analytics & Tools → Post analytics → Export. Put both in one directory.

**2. Get a key.** Any one of the three providers above.

**3. Run it.**

```bash
export AI_GATEWAY_API_KEY=...
npx jev-notetaker doctor
npx jev-notetaker run ./exports
```

`doctor` verifies Node, your key, the pack, and makes one live call before you spend anything on a full run.

## Writing your own rubric pack

A pack is a versioned set of typed questions plus the fields each question may see. LinkedIn is one pack; newsletters, video titles, documentation and cold email are ordinary user-space files.

```js
import { score, bool } from 'jev-notetaker/rubrics/pack.mjs';

export default {
  id: 'newsletter', version: '1.0.0',
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

`validatePack` runs before a single call is spent and rejects Score questions outside 2–10 levels, Choice questions with no no-match option, unknown tiers, and instructions referencing state the pack never declared.

## Use it from an agent

The repo ships an agent skill for Claude Code, Codex and other agent environments. It walks a user through exporting their data, obtaining a key, running the pipeline, and reading the result without overstating it.

```bash
npx skills add https://github.com/Kaos599/jev-notetaker --skill jev-notetaker
```

## FAQ

**Does this work for platforms other than LinkedIn?** Yes. The statistics and the rubric format are platform-agnostic. You need an adapter that produces items with text and an outcome, plus a rubric pack. LinkedIn ships in the box.

**Do I need a TypeSafe account?** No. TypeSafe operated a waitlist at launch; the AI Gateway and OpenRouter providers reach the same model without one.

**Does my writing get used for training?** Zero Data Retention is requested on every AI Gateway call. Check your provider's terms — this tool sends your content to a third party and cannot make guarantees on their behalf.

**Why does it refuse to give me findings?** Because you have fewer than 25 posts with outcome data. At that size, correlations are dominated by noise, and any confident answer would be fabricated. Descriptives are still shown.

**Can I use a normal LLM instead of Jev?** Partly. The AI SDK's `evaluate` works with OpenAI, Anthropic and Google models through an adapter, but those do not return calibrated probability distributions, so the rubric-health check and the confidence gating stop working.

## Contributing

New rubric packs and platform adapters are the most useful contributions. See [CONTRIBUTING.md](CONTRIBUTING.md). Packs must declare their pre-registration tiers and pass `validatePack`.

## License

MIT
