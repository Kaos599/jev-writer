# Exporting your own posts and engagement data

**Only LinkedIn ships an adapter.** Everything below is a survey of what a person
can actually get out of each platform, so you can judge whether an adapter and a
rubric pack are worth writing. The pipeline needs items with text plus at least
one outcome; where the table says engagement is absent from the export, the
analysis stops at descriptives. The LinkedIn route is in `SKILL.md`, and writing
a pack is covered in `rubric-authoring.md`.

Status as of **September 2026**. Export UI paths, field names, and API terms on all these platforms change frequently and without notice - treat every "exact filename" claim below as verified against the cited source on the date of that source, not as a permanent guarantee. Where a source could not be confirmed, this is called out explicitly rather than guessed.

---

## 1. X / Twitter

### 1a. "Download an archive of your data"

**UI path:** Settings and privacy → Your Account → Download an archive of your data (confirm identity/password, then request).

**Turnaround:** Historically 24–48 hours; X emails a download link that **expires after ~7 days**, requiring a fresh request if missed. [Tweet Archivist, 2026](https://www.tweetarchivist.com/download-twitter-archive-complete-guide)

**Format:** A single ZIP (e.g. `twitter-2026-06-29-xxxxxxxx.zip`) containing an `archive.html` offline viewer plus a `data/` folder of `.js` files. Despite the extension, these are JSON wrapped in a one-line JS variable assignment, e.g.:
```
window.YTD.tweets.part0 = [ { "tweet": { ... } }, ... ]
```
[Tweet Archivist, 2026](https://www.tweetarchivist.com/twitter-archive-format-explained); confirmed independently by [seramo/twitter-archive-docs](https://github.com/seramo/twitter-archive-docs) and multiple parser repos ([alkihis/twitter-archive-reader](https://github.com/alkihis/twitter-archive-reader/blob/master/Files_to_structures.md), [kltownsend/tweet2csv](https://github.com/kltownsend/tweet2csv)).

**Filename note (gotcha):** The tweet file has been named both `tweets.js` and `tweet.js` across different archive-format eras (older exports moved data around; see [django-ditto issue #229](https://github.com/philgyford/django-ditto/issues/229), which documents X changing the file/directory structure between 2022 exports). **Do not hardcode a single filename** - check for both `data/tweets.js` and `data/tweet.js`, and possibly a `data/tweets-part0.js`/multi-part split for large accounts.

**Fields inside each tweet object** (per multiple sources, cross-checked against a real sample in [gist: bitsgalore](https://gist.github.com/bitsgalore/cfdff3ce67f1ffa85f67e87c778a9e75)):
- `id`, `id_str`, `created_at`, `full_text`, `lang`, `source`, `truncated`, `favorited`, `retweeted`
- `favorite_count`, `retweet_count` - **present as fields, but reported to be zeroed out / not real engagement counts in the archive** ("Twitter doesn't include actual engagement metrics in archives" - [Tweet Archivist, 2026](https://www.tweetarchivist.com/twitter-archive-format-explained)). Treat any non-zero value in these fields with caution and do not rely on the archive for engagement history.
- `entities.hashtags[]`, `entities.user_mentions[]`, `entities.urls[]`, `extended_entities.media[]`
- `in_reply_to_status_id`, `in_reply_to_status_id_str`, `in_reply_to_screen_name`
- `edit_info.initial.{editTweetIds, editableUntil, editsRemaining, isEditEligible}` (edit history, added ~2022)

**What is NOT in the archive:** impressions, reach, or any performance/analytics data. The archive is a content/metadata backup only. [Tweet Archivist, 2026](https://www.tweetarchivist.com/twitter-archive-format-explained)

**Other files in `data/`:** `account.js`, `profile.js`, `follower.js`, `following.js`, `direct-messages.js`, `like.js`, `ad-impressions.js`, `personalization.js`. Note the archive **includes likes but not bookmarks** - a long-standing gap as of 2026. [Tweet Archivist](https://www.tweetarchivist.com/twitter-archive-format-explained)

**Parser gotcha:** Nested JSON-in-JS wrapper must be stripped (`.replace(/^window\.YTD\.\w+\.part\d+\s*=\s*/, '')`) before `JSON.parse`. Numeric-looking fields (`id`, `favorite_count`, `retweet_count`, `indices[]`) are sometimes serialized **as strings**, not numbers - confirmed in the raw sample above (`"favorite_count" : "16"`, `"indices" : ["202","211"]`). Cast explicitly.

### 1b. X Analytics (analytics.x.com / analytics.twitter.com)

**Gating:** As of the June 2024 policy change (still in effect through 2026), the **full account-wide analytics dashboard requires X Premium** (from $8/mo) or X Premium+; Basic ($3/mo) does not include it. Free accounts are NOT locked out entirely - tapping the bar-chart icon under an individual post (mobile or desktop) shows impressions/likes/replies/reposts for that one post, for free, with no CSV export. [Swydo, 2026](https://www.swydo.com/blog/x-analytics-metrics); [ficilcom.jp, 2026](https://www.ficilcom.jp/en/blog/how-to-use-x-analytics); [tendX, 2026](https://www.tendx.app/blog/how-to-use-x-twitter-analytics)

**CSV export path (Premium required):** `x.com/i/account_analytics` (or the legacy `analytics.twitter.com`/`analytics.x.com` URLs, which still work) → Content/Tweets tab → set date range → "Export data" → CSV. [opentweet.io](https://opentweet.io/tools/x-analytics-csv-analyzer); [tweetarchivist.com, 2026](https://www.tweetarchivist.com/how-to-use-twitter-analytics-2025)

**Fields in the export (per multiple guides, not independently verified against a real downloaded file in this research pass):** Tweet ID/permalink, tweet text, date/time, impressions, engagements, engagement rate, retweets/replies/likes as individual counts, link clicks, profile clicks, media views/engagements, hashtag clicks, detail expands, app opens/installs. [Mailchimp](https://mailchimp.com/resources/how-to-use-twitter-analytics/); [tweetarchivist.com](https://www.tweetarchivist.com/how-to-use-twitter-analytics-2025)

**Date range limit:** The on-screen dashboard is commonly reported as a rolling **28-day window**; CSV export is reported to reach back **up to ~90 days** in some accounts. [tendX, 2026](https://www.tendx.app/blog/how-to-use-x-twitter-analytics); [Tweet Archivist, 2026](https://www.tweetarchivist.com/how-to-use-twitter-analytics-2025). These figures vary by source and are **not from an official X document** in this research pass - flag as **unverified against a primary X source**.

**Not verified:** exact CSV column headers (multiple secondary sources roughly agree, but none is X's own documentation - X does not appear to publish a formal export-schema page as of this research).

### 1c. X API v2 for reading your own tweets (2026)

X removed its free developer tier in **February 2026**; the platform is now **pay-per-use by default**: ~$0.005 per post read, ~$0.015 per post write ($0.20 if the post contains a link), capped at 2,000,000 reads/month. Legacy Basic ($200/mo, ~10–15k reads/mo) and Pro ($5,000/mo, ~1M reads/mo) plans are closed to new signups and being force-migrated to pay-per-use (Basic subscribers migrated after June 1, 2026). Enterprise starts around $42,000/month. [postproxy.dev, 2026](https://postproxy.dev/blog/x-api-pricing-2026); [blotato.com, 2026](https://www.blotato.com/blog/twitter-api-pricing); [xpoz.ai, 2026](https://www.xpoz.ai/blog/guides/understanding-twitter-api-pricing-tiers-and-alternatives)

One source claims reading **your own** account data is discounted to ~$0.001/request ("the only zero-cost access is reading your own account data at $0.001 per request" - [xpoz.ai](https://www.xpoz.ai/blog/guides/understanding-twitter-api-pricing-tiers-and-alternatives)), but this figure appears in only one secondary source and could not be cross-verified against X's own developer pricing page in this pass - **flag as low-confidence, unverified**.

**Bottom line for a self-service tool:** there is no meaningful free official API path in 2026. The data archive (§1a) plus manual/Premium analytics CSV (§1b) is the realistic zero-cost route for an individual reading their own tweets and engagement.

---

## 2. Medium

### 2a. Download your information

**UI path:** Profile picture → Settings → **Security and apps** tab → **Download your information** → confirm → Export. [help.medium.com](https://help.medium.com/hc/en-us/articles/115004745787-Export-your-account-data) (fetched via search cache; direct fetch returned HTTP 403 in this session, so treat as medium-confidence secondary confirmation of the official article's content, corroborated by three independent how-to posts below)

**Delivery:** A download link is emailed when the export is ready (processing time not specified in the sources found - **unverified**, budget for it being non-instant like other platforms' exports).

**Format:** ZIP archive containing multiple **HTML** files/folders (a "posts" folder with your own published articles, plus everything you've written including comments, listed reverse-chronologically). This is explicitly HTML, not Markdown or JSON - several third-party tools exist specifically to convert this export to Markdown (e.g. [gautamdhameja/medium-2-md](https://github.com/gautamdhameja/medium-2-md)). [jhsu98.medium.com](https://jhsu98.medium.com/how-to-export-all-your-medium-content-bb3dc7587a5a); [elye-project.medium.com](https://elye-project.medium.com/the-hidden-important-medium-writer-feature-zip-your-medium-data-5319a1b7b542)

**Stats/claps in the export:** **Not confirmed present.** No source in this research pass documents per-story view/read/clap counts inside the ZIP. The consistent description across sources is "posts as HTML" plus account/comment history - treat stats-in-export as **unverified, probably absent**.

**On-screen stats dashboard:** Medium's built-in Stats page (accessible to any writer at `medium.com/me/stats`) shows per-story views, reads, read ratio, and fan/clap counts, but no official export/CSV button for it was found in this research pass. Third-party browser extensions exist specifically to scrape this screen (e.g. "Medium Stats Export" Chrome extension), which itself is evidence there's no native export. [Chrome Web Store listing](https://chromewebstore.google.com/detail/medium-stats-export/lnnogehgjdeccakdogbeinkhphconjbd?hl=en-GB)

### 2b. Medium API

Medium's public API is **deprecated**. Its GitHub repo is archived with a warning that it "is no longer supported and is not recommended for use." One source claims an integration-token feature is still technically reachable in account settings and unofficially functional, but this is unverified, unsupported, and should not be relied on for a public tool. [medium.surfingdoggo.com](https://medium.surfingdoggo.com/bummer-vote-with-a-comment-if-you-want-it-back-too-readers-unite-40a2c8b3a37a) (secondary/blog source; no official Medium statement located confirming current API status beyond the archived-repo notice)

**Bottom line:** For Medium, an open-source tool should plan on (1) parsing the HTML export for post text/dates/URLs, and (2) telling users that per-post stats have no export path - only the on-screen dashboard, scraped at their own risk (fragile, ToS-adjacent).

---

## 3. Substack

### 3a. Posts + subscriber export

**UI path:** Settings → **Import/Export** (left sidebar, near the bottom of Settings) → **Export your data** → New export. [YouTube walkthrough transcript, 2026](https://www.youtube.com/watch?v=EsEg1JA5hnY); corroborated by [WebSearch summary of Substack support content, 2026]

**Format:** A ZIP containing:
- `posts.csv` - a CSV listing of your posts
- a `posts/` folder with **one HTML file per published post**
- an email/subscriber list CSV (`email_list.[name].csv` per [Buttondown's Substack-import docs](https://docs.buttondown.com/substack))

(Per WebSearch synthesis of Substack help content - not independently fetched from support.substack.com in this session due to a 403 on direct WebFetch; corroborated by the Buttondown migration doc which references the same export ZIP structure.)

**Subscriber export separately:** Subscribers page → **Export CSV** button (top right) → choose "all columns" (includes last-open date, individual post view data) or "visible columns only" (subscription date, plan type). [tella.com/Substack docs summary](https://www.tella.com/definition/subscriber-export)

### 3b. Per-post stats - export vs. dashboard only

The **Stats → Posts** page on Substack shows, per post: title, send date, audience, email deliveries and opens, open rate, free/paid subscriptions driven, likes, comments, shares - as an **on-screen sortable table**. [support.substack.com - A guide to Substack metrics](https://support.substack.com/hc/en-us/articles/5320347155860-A-guide-to-Substack-metrics) (direct fetch 403'd; content confirmed via Tavily search snippet of the same URL)

Whether this table has a **native CSV export button** could not be confirmed from official docs in this pass - no source explicitly showed an "export" control on the Stats → Posts screen. The "export your data" flow in §3a (posts.csv) is a **content** export, not confirmed to include the same delivery/open/click numbers.

### 3c. Substack's own analytics API (unofficial)

Substack does not publish a public API, but its **internal REST endpoints** (used by its own dashboard) are reachable while authenticated as the account owner and have been reverse-engineered by third parties, e.g.:
- `/api/v1/post_management/detail/{post_id}` - per-post clicks (broken down by link), shares, likes, comments, restacks, signups/paid-conversions attributed to that post
- `/api/v1/publication/stats/email_stats` and `/email_stats/30d_open_rate` - per-post email delivery/open/click metrics
- `/api/v1/publication/stats/growth/sources` - subscriber source breakdown

[wonderingaboutai.substack.com, 2026](https://wonderingaboutai.substack.com/p/i-built-a-chrome-extension-to-audit) - **this is a single unofficial source (a hobbyist's write-up), not documented by Substack itself.** Flag as low-confidence / unofficial; these are not public API contracts and could change or be blocked without notice. The same source notes a parsing gotcha: Substack's "clicks" metric folds in clicks on the in-email "Like" button, inflating click-through-rate unless explicitly filtered out.

**Bottom line:** Substack gives authors a real content export (posts.csv + HTML + subscriber CSV) but the most granular per-post engagement numbers (opens, click detail) live primarily in the on-screen Stats dashboard and an unofficial, unauthenticated-by-Substack internal API - there is no confirmed official, documented per-post-stats export file.

---

## 4. YouTube

### 4a. YouTube Studio Analytics - CSV/Sheets export

**UI path:** YouTube Studio → Analytics (left menu) → find the report → **Advanced Mode** (or "See more") → adjust as needed → **Export current view** → choose format. [Google Help - Advanced mode for analytics reports](https://support.google.com/youtube/answer/9717005?hl=en)

**Cap:** Native Studio export via Advanced Mode is capped at **500 rows**; to get more than 500 rows of data you must use the **YouTube Reporting API** (bulk CSVs) instead. [Google Help, same page](https://support.google.com/youtube/answer/9717005?hl=en)

**Per-video metrics available:** views, watch time (minutes), average view duration, likes, comments, shares, subscribers gained/lost, traffic-source breakdown (search, suggested, browse, external, playlists), audience demographics (age, gender, geography, device, playback location), and for monetized channels: estimated revenue, RPM, CPM. Date range customizable from 1 day to lifetime. [youtubetoolkit.com, 2026-06-25](https://youtubetoolkit.com/blog/how-to-get-my-youtube-channel-data-as-csv) (secondary source; cross-checked against the general shape of the official Analytics API metrics list)

**Data finalization delay:** Metrics are reported to finalize 48–72 hours after the fact; Studio shows provisional/estimated numbers before that. [youtubetoolkit.com, 2026](https://youtubetoolkit.com/blog/how-to-get-my-youtube-channel-data-as-csv) - this specific delay window is from a secondary source, not an official Google statement located in this pass.

**500-video ceiling gotcha:** For channels with >500 videos, the native CSV export silently truncates with no warning; workaround is manual date-range slicing and merging, or using the API. [youtubetoolkit.com, 2026](https://youtubetoolkit.com/blog/how-to-get-my-youtube-channel-data-as-csv)

### 4b. YouTube Analytics API v2 / YouTube Reporting API

Two distinct official APIs, both OAuth 2.0-only for private per-channel data:

- **YouTube Analytics API** (`reports.query`) - targeted queries, `startDate`/`endDate`/`metrics`/`dimensions`/`filters` parameters, JSON or CSV response. Quota: **10,000 queries/day**, no paid tier to buy more - you must submit a manual quota-increase audit form to Google and wait. [Google Developers - Reports: Query](https://developers.google.com/youtube/analytics/reference/reports/query); [youtubetoolkit.com](https://youtubetoolkit.com/blog/how-to-get-my-youtube-channel-data-as-csv)
  - Traffic-source report constraint: `(# videos queried) × (# days in range) ≤ 50,000` or the API errors. [Google Developers - Revision History](https://developers.google.com/youtube/reporting/revision_history)
- **YouTube Reporting API** - bulk daily CSV reports (per-24-hour period), designed for large datasets; reports containing non-historical data available for **60 days**, historical-backfill reports available for **30 days**, after which they become inaccessible. [Google Developers - YouTube Reporting API](https://developers.google.com/youtube/reporting/v1/reports)

**YouTube Data API v3** (separate from Analytics) - public metadata (titles, descriptions, tags, public view/like/comment counts) via API key, or OAuth for private data. Quota: 10,000 units/day; `playlistItems.list` and `videos.list` cost 1 unit per call (50 items), `search.list` costs 100 units/call - guidance is to avoid `search.list` and instead page through `playlistItems.list` → `videos.list` in batches of 50, which keeps even a 5,000-video channel under 50 units/day. [Google Developers - YouTube Data API v3](https://developers.google.com/youtube/v3); cost breakdown per [youtubetoolkit.com, 2026](https://youtubetoolkit.com/blog/how-to-get-my-youtube-channel-data-as-csv) and [Bin-Huang/youtube-analytics-cli](https://github.com/Bin-Huang/youtube-analytics-cli)

Both official APIs are **free of monetary charge** - the constraint is the daily quota, not billing. [youtubetoolkit.com, 2026](https://youtubetoolkit.com/blog/how-to-get-my-youtube-channel-data-as-csv)

### 4c. Google Takeout for YouTube

**UI path:** `takeout.google.com` → Deselect all → select **YouTube and YouTube Music** → choose categories (playlists, subscriptions, comments/live chat, history, videos) → choose format (JSON recommended over legacy HTML for `history`; **playlists, subscriptions, and comments always export as CSV with no format choice**) → Create export. [quiki.io, 2026](https://quiki.io/how-to-download-youtube-data); confirmed structurally by [Google's Data Portability API schema reference](https://developers.google.com/data-portability/schema-reference/youtube)

**What it contains:** video files (original format if uploaded <~6 months ago, otherwise transcoded MP4/H.264+AAC), playlists (CSV: one file per playlist, video ID + date-added only, not full metadata), subscriptions, your own comments/live chats, liked videos, channel posts. **Does not include per-video analytics/engagement** - Takeout is a content/activity backup, not an analytics export. [tubefetcher.com, 2026-03-22](https://tubefetcher.com/blog/archive-youtube-channel-backup/); [karlicoss/google_takeout_parser](https://github.com/karlicoss/google_takeout_parser)

**Parser gotchas:**
- Comment CSVs store the actual comment text as a **nested JSON blob** inside a CSV cell (a `takeoutSegments` array with text/link fragments), not as plain text - requires a second parse pass. [karlicoss/google_takeout_parser README](https://github.com/karlicoss/google_takeout_parser)
- Video filenames in the export are **truncated to 55 characters** and de-duplicated with `(1)`, `(2)` suffixes, with **no reliable field linking the truncated filename back to the video ID** in the accompanying metadata CSVs - a documented unsolved matching problem. [Stack Overflow: Working with Google Takeout's video metadata](https://stackoverflow.com/questions/79277419/working-with-google-takeouts-video-metadata)
- Download links expire after about a week; Takeout is a static one-time snapshot with no incremental/delta re-export. [tubefetcher.com, 2026](https://tubefetcher.com/blog/archive-youtube-channel-backup/)

---

## 5. Reddit

### 5a. GDPR/CCPA-style data request

**UI path:** `reddit.com/settings/data-request` (must be logged into the account requesting data) → follow prompts → Submit. [Reddit Help - How do I request a copy of my Reddit data and information?](https://support.reddithelp.com/hc/en-us/articles/360043048352-How-do-I-request-a-copy-of-my-Reddit-data-and-information)

**Turnaround:** Up to **30 days** to prepare; Reddit sends a notification to the account's Reddit inbox with a download link when ready. [Reddit Help, same article](https://support.reddithelp.com/hc/en-us/articles/360043048352-How-do-I-request-a-copy-of-my-Reddit-data-and-information)

**Format:** Community/tooling reports describe the export as containing **`posts.csv`** and **`comments.csv`** among other files. [WebSearch summary citing Reddit GDPR export structure, 2026] - **this specific filename pair is from secondary/community sources (e.g. the "Reddit GDPR Export Data Viewer" tool and community guides), not an official Reddit schema document**, so treat exact filenames as likely-but-unconfirmed. Reddit's official help article does not appear to enumerate file names.

**Karma/score per post:** Not confirmed to be included in the GDPR export CSVs in any source found in this pass. Reddit's UI-accessible account settings (not the formal data request) separately expose posts, comments, votes, recent IPs, and preferences, per the same Reddit Help article - but again without a documented schema.

### 5b. Reddit API / PRAW for a user's own posts

PRAW (Python Reddit API Wrapper) is the standard client library; it supports pulling your own submissions via the Reddit API with fields like `id`, `title`, `url`, `permalink`, `subreddit`, `created_utc`, `score` (karma for that post), `num_comments`, etc. - standard Submission object attributes exposed by PRAW/Reddit's API. [danielkliewer.com, 2025-10-21](https://www.danielkliewer.com/blog/2025-10-21-ultimate-guide-export-your-reddit-data-to-markdown-using-python-and-PRAW-API); [karlicoss/rexport](https://github.com/karlicoss/rexport) (JSON export tool built on the same API surface: comments, submissions, upvotes)

**Rate/volume limit:** Reddit's API listing endpoints are commonly reported to cap at **1,000 items** per listing (a long-standing Reddit API constraint, not specific to 2026), which matters for accounts with very long posting histories. [WebSearch summary, 2026] - this is a widely repeated community claim; no official 2026 Reddit API doc was fetched in this pass to pin the exact current number, so treat as **likely correct but not freshly confirmed against Reddit's current developer docs**.

**Auth:** OAuth2 (script-type app registered at reddit.com/prefs/apps) with username/password or refresh-token flow for reading your own account's private-ish data (saved posts, vote history); public posts/comments are readable without auth for basic listing endpoints.

---

## 6. Instagram / Threads

### 6a. Meta "Download your information" (Accounts Center)

**UI path:** Instagram Settings → **Accounts Center** → **Your information and permissions** → **Download your information** → Create export → select profile → choose destination (device or transfer to a linked service) → choose format (**JSON or HTML**) and media quality → Confirm. [Facebook Help - Access and download your information on Instagram](https://www.facebook.com/help/instagram/181231772500920) - official Meta help page, directly corroborates the step sequence found in secondary walkthroughs.

**Turnaround:** Meta's official stated ceiling is **up to 30 days**; a narrow request (e.g. only "Saved") is anecdotally reported to often complete within hours to a couple of days. [redact.dev](https://redact.dev/blog/instagram-data-file-download) (secondary source for the "hours to days in practice" claim - the 30-day figure is Meta's own official SLA language, seen consistently across Meta help content).

**Format contents:** JSON gives structured data per category (posts, comments, follows, messages, ads activity, account history); HTML gives a clickable browsable version of the same. A `saved_posts` file/category provides only **links + timestamps** to saved content, not the saved posts' actual content. [WebSearch synthesis, 2026, based on multiple how-to guides]

**Critical gotcha - insights are NOT meaningfully in this export:** Per a source explicitly warning about this exact confusion: "You may find a 'Download your information' feature... Avoid this for analytics. That feature is designed for data privacy compliance... The insights data included there isn't organized for reporting." [trypostbase.com, 2025-10-31](https://www.trypostbase.com/resources/how-to-export-instagram-insights-data) - i.e., per-post reach/impressions/saves are not usably present in the Accounts Center export; you must use Insights (§6b) or the Graph API (§6c).

### 6b. Instagram/Threads Professional dashboard & Insights (on-screen)

**Requires a Professional (Business or Creator) account** - personal accounts have no Insights at all. [help.instagram.com - About Instagram insights](https://help.instagram.com/788388387972460/)

**Per-post/reel/story metrics on-screen:** views, reach ("Viewers" - unique accounts, distinct from views which counts repeats), likes, comments, saves, shares, profile activity/visits, follows generated, and for Reels: plays, watch time, skip rate. Account-level Insights covers reach, accounts engaged, follower demographics, profile activity, over 7/14/30/90-day windows - capped at roughly **90 days of history** on-screen. [postzen.dev, 2026-09-09](https://www.postzen.dev/blog/instagram-insights-explained); [inro.social, 2026-01-28](https://www.inro.social/blog/instagram-dashboard-professional-dashboard-guide); [help.instagram.com](https://help.instagram.com/788388387972460/)

**CSV export path for Insights (the one that actually works):** Instagram → More → **Meta Business Suite** → Insights → Content tab → **Export Data** (top right) → pick account/date-range/post-or-story → Generate → Download. This produces a real CSV (not PDF). [poststeady.com, 2026-08-31](https://www.poststeady.com/resources/export-instagram-insights-to-csv); [trypostbase.com, 2025-10-31](https://www.trypostbase.com/resources/how-to-export-instagram-insights-data)

**Column-naming gotcha (breaks naive parsers):** Meta Business Suite's exported CSV headers do **not** match the on-screen Insights labels. E.g. there is no column literally called "Reach" - it's "Accounts reached"; "Likes" may appear as "Reactions"; "Shares" may appear as "Reposts", depending on which export variant was generated - and these header names have been observed to shift between export runs. [poststeady.com, 2026-08-31](https://www.poststeady.com/resources/export-instagram-insights-to-csv)

### 6c. Instagram Graph API (official, for developers)

Endpoints: `GET /<IG_MEDIA_ID>/insights` (per-post) and `GET /<IG_USER_ID>/insights` (account-level), OAuth-authenticated, only works for **professional accounts** (Business/Creator) - cannot fetch data for personal-account media at all. [developers.facebook.com - Instagram Platform Insights](https://developers.facebook.com/docs/instagram-platform/insights/)

**Metric naming churn (gotcha for a parser/tool):** `impressions` was **removed from the API on April 21, 2025**, replaced by `views` as the primary metric; `saved` (not "saves") is the correct API field name; `reach` is explicitly documented as "**estimated**", not exact. New metrics like `reposts` (Dec 2025) and story `link_clicks` (June 2026) have been added recently, meaning a metric list written even a year prior would already be stale. [postzen.dev, 2026-09-09](https://www.postzen.dev/blog/instagram-insights-explained), which itself cross-cites the official [developers.facebook.com Instagram Media Insights reference](https://developers.facebook.com/docs/instagram-platform/reference/instagram-media/insights/).

**Auth difficulty:** Requires a registered Meta developer app, Instagram professional-account login/business-asset linkage, permission review for some scopes, and token refresh handling - materially harder to bootstrap solo than X's or YouTube's OAuth flows, though the API itself is free of direct monetary cost.

### 6d. Threads specifically

Threads has its own "Threads Insights" (AI-summarized as of an August 2026 Meta update) but this research pass did not locate a confirmed, separate Threads-only export or API distinct from the general Meta Accounts Center "Download your information" flow and the Instagram/Threads shared Graph API surface. [embedsocial.com, 2026](https://embedsocial.com/blog/new-threads-features-2026) mentions the Insights AI-summary feature but not an export mechanism - **flag Threads-specific export/API details as not independently verified in this pass; likely follows the same Accounts Center path as Instagram since both sit under one Meta account, but this should be confirmed directly against a live account before shipping a parser.**

---

## Cross-Platform Summary Table

| Platform | Own-post content export | Per-post engagement in that export? | Per-post metrics export exists at all? | Paid tier required for full analytics? | Official read API for own content |
|---|---|---|---|---|---|
| X/Twitter | Yes (ZIP, JSON-in-.js) | No (counts present but reported non-real/zeroed) | Yes, CSV via analytics.x.com | Yes (Premium, ~$8/mo) for dashboard+export; free per-post view is view-only, no export | Pay-per-use only in 2026, no free tier |
| Medium | Yes (ZIP of HTML) | Not confirmed present | No confirmed export; dashboard only | No (stats page is free) but no export | API deprecated/unsupported |
| Substack | Yes (posts.csv + HTML + subscriber CSV) | Not confirmed in that export | Stats→Posts is on-screen; no confirmed CSV button; unofficial internal API exists | No (native features free) | No public API; unofficial internal endpoints only |
| YouTube | Yes (Takeout, CSV/JSON/video files) | No (Takeout has no analytics) | Yes - Studio CSV (500-row cap) or Reporting/Analytics API (bulk) | No (all free; quota-limited not paywalled) | Yes, free, quota-capped (10,000 units/day) |
| Reddit | Yes (GDPR request, ~30 days) | Possibly (community-reported posts.csv/comments.csv, unconfirmed schema) | Unclear/unconfirmed for karma-per-post in official export | No | Yes, via PRAW/OAuth, ~1,000-item listing cap (unconfirmed current figure) |
| Instagram/Threads | Yes (Accounts Center, JSON/HTML) | No - explicitly not analytics-grade | Yes - Meta Business Suite CSV export | No (Insights free for Professional accounts) | Yes, Graph API, professional accounts only, metric names churn frequently |

---

## Notes on Research Confidence

- **High confidence / directly corroborated by an official platform help page:** X archive format and contents (§1a), Reddit's GDPR request path and 30-day SLA (§5a), YouTube Studio export path and 500-row cap (§4a), YouTube API quota mechanics (§4b), Meta's Download Your Information UI path (§6a), Instagram Insights account-type requirement (§6b).
- **Medium confidence / consistent across several independent secondary sources but not fetched from the platform's own docs in this session:** Medium's export path/contents (§2a - help.medium.com blocked direct fetch, relied on search-cache + 3 independent how-to posts), Substack's export structure (§3a - support.substack.com blocked direct fetch), X Analytics CSV column list (§1b).
- **Low confidence / single-source or explicitly unofficial:** Substack's internal stats API endpoints (§3c, one hobbyist blog), Reddit GDPR export filenames (§5a, community tooling only), the claimed $0.001/request "own tweets" discount on the X API (§1c, one source), Threads-specific export mechanics (§6d, not directly found).
- **Not found / explicitly flagged as gaps:** an official, documented schema for Reddit's GDPR export files; a native CSV-export button on Substack's Stats→Posts screen; confirmation of Medium export processing time; any evidence engagement counts in the X archive are real rather than placeholder zeros.

Anyone building a parser against this document should re-verify field names and file names against a **freshly pulled real export** before shipping, given how often every one of these platforms has changed export formats in the recent past (X's tweet.js/tweets.js rename, Instagram's impressions→views API cutover, X's February 2026 API pricing overhaul).
