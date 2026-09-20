# Security

## Reporting a vulnerability

Open a [private security advisory](https://github.com/Kaos599/jev-writer/security/advisories/new). Please do not open a public issue for anything exploitable.

## What this tool does with your data

Worth stating plainly, because the whole point of the tool is to read things you wrote.

**Your posts are sent to a third party.** Every rating is an API call carrying the text of one post to whichever provider your key belongs to: Vercel AI Gateway, OpenRouter, or TypeSafe. Zero Data Retention is requested on AI Gateway calls. This project cannot make guarantees on a provider's behalf, so read their terms.

**Nothing is sent anywhere else.** There is no telemetry, no analytics, no phone-home, and no network call the CLI makes that is not a rating request to your chosen provider.

**Everything else stays local.** Exports are parsed on your machine. `corpus.jsonl`, `ratings.jsonl`, `report.json` and `dashboard.html` are written to `jev-out/` and never transmitted.

## Things not to commit

`report.json` and `dashboard.html` both embed the full text of every post in your corpus. `jev-out/` is gitignored for that reason. Check before you attach either to an issue.

Keys are read from the environment. The CLI never writes a key to disk and never prints one, including in error output. Use `.env.example` as a template and keep your real `.env` out of git.

## Supported versions

Pre-1.0. Fixes land on the latest release only.
