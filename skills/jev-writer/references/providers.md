# Providers: getting a key and adding new ones

Jev is reachable through three transports today. The tool auto-detects whichever
key is present, so the user sets one environment variable and nothing else.

**Never ask a user to paste an API key into a chat.** Have them set it in their
shell or a local `.env`, then run `doctor`, which confirms the key works without
ever displaying it:

```bash
npx github:Kaos599/jev-writer doctor   # or, from a clone: node src/cli.mjs doctor
```

The package is not on npm, so `npx jev-writer doctor` does not resolve.

## The three routes

| Provider | Env var | Model id | Where to get it |
| --- | --- | --- | --- |
| Vercel AI Gateway | `AI_GATEWAY_API_KEY` | `typesafe-ai/jev` | Vercel dashboard → AI Gateway |
| OpenRouter | `OPENROUTER_API_KEY` | `~typesafe/jev-latest` | openrouter.ai keys page |
| TypeSafe direct | `TYPESAFE_API_KEY` | `jev-latest` | console.typesafe.ai |

Recommend whichever the user already has an account with. If they have none,
OpenRouter is usually the fastest to obtain.

Set exactly one. If several are set, the first present in the order above wins,
and `doctor` prints both which one it chose and a note that others were ignored.

## Why these are not interchangeable URLs

They are three different protocols, which is why each gets its own adapter file
rather than a shared base-URL constant.

- **Vercel AI Gateway** exposes evaluation *only* through the AI SDK's
  `experimental_evaluate` (requires `ai` >= 7.0.105). It is deliberately absent
  from the gateway's OpenAI-compatible endpoints, so there is no plain-HTTP path.
  This is the most common source of confusion: a user with a working gateway key
  and an old `ai` package gets a confusing failure, which is exactly what
  `doctor` exists to catch.
- **OpenRouter** uses a dedicated Decisions API at
  `POST https://openrouter.ai/api/alpha/decisions`.
- **TypeSafe direct** uses `POST https://api.typesafe.ai/v1/systemone`.

Their vocabularies differ too. The AI SDK calls a yes/no question `boolean` and
returns `{probability}`; OpenRouter and TypeSafe call the same thing a `noul` and
return `{noul}`. Rubric packs are authored once in the AI SDK dialect and each
provider translates on the way in and out.

## Cost

Jev is priced at **$0.042 per million input tokens, output free**. Rating 178
posts with 30 questions at 5 repetitions each is 890 calls, which consumed
roughly 7.4M input tokens: about $0.31.

The practical consequence is methodological rather than financial: because a
full pass is nearly free, rubrics can be rewritten and re-run many times while
tuning level descriptions, which is where the quality of this analysis actually
lives. Always check current pricing before a large run; TypeSafe launched in
September 2026 and pricing has been moving.

## Privacy

This tool sends a person's private writing to a third party. Treat that as a
material fact, not a footnote.

- Zero Data Retention is requested on every AI Gateway call
  (`providerOptions.gateway.zeroDataRetention`). The other two transports have no
  equivalent flag in this codebase, so on those routes the provider's own default
  applies.
- Tell the user which provider their content will reach, and point them at that
  provider's terms rather than making guarantees on the provider's behalf.
- Never commit a corpus, ratings, or a generated dashboard that embeds post text.
  The repo's `.gitignore` excludes the whole output directory (`jev-out/`) plus
  `data/`, `out/`, `*.jsonl`, `dashboard.html` and `report.json` for this reason.
  An earlier version listed only file types and missed `jev-out/report.json`.

## Adding a fourth provider

1. Write `src/providers/<name>.mjs` exporting one async function that takes
   `{ state, questions, model }` and returns the normalised shape:
   - `score`   → `{ type:'score',   value, probabilities, confidence }`
   - `boolean` → `{ type:'boolean', value }` where `value` is P(true)
   - `choice`  → `{ type:'choice',  value, probabilities, confidence }`
2. Translate the question dialect on the way in if the provider uses `noul`.
3. Register it in `src/providers/index.mjs` with its env var, model id and docs
   URL, and add it to `ORDER` at the preference position you want.
4. `doctor` picks it up automatically.

Nothing else in the codebase needs to change: the rubric packs, the statistics
and the report layer are all provider-agnostic by construction.
