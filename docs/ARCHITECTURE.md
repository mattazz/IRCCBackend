# Architecture

Orientation doc for anyone (human or agent) reviewing this codebase. For user-facing setup and commands, see the [readme](../readme.MD).

## Overview

Single Node.js process, single Express app, with **two consumers** of the same underlying data modules:

1. **Telegram bot** (`app.js`) — webhook-driven, fetches/scrapes IRCC live on every command.
2. **Public JSON API** (`src/routes/`, mounted in `app.js`) — read-only, serves the same kind of data (news, draws, speeches) to a website frontend, but reads from an in-process cache (`src/utils/dataCache.js`) instead of hitting IRCC per request. See [API.md](API.md) for the full route reference and [DEVELOPMENT_PLAN.md](DEVELOPMENT_PLAN.md) for why it's built this way.

MongoDB is the only persistent state (speech articles). News and draws are never persisted — the bot fetches them live, the API serves them from memory (refreshed every 15 min), and both go back to IRCC directly if the cache/live-fetch fails.

```
                                   ┌─ Telegram ──webhook──> bot.onText handlers (app.js)
                                   │                                  │
                                   │        ┌─────────────────────────┼───────────────────────┐
                                   │        ▼                         ▼                        ▼
                                   │  rssParser.js            irccDrawScraper.js       speechNewsParser.js
                                   │  (IRCC RSS, live)        (IRCC JSON, live)        (reads MongoDB)
                                   │        │                         │                        │
                                   │        ▼                         ▼                        ▼
                                   │  filterItemsByMonth/       irccDrawAnalyzer.js     mongoDBConnect.js
                                   │  Keyword (pure)            chartGenerator.js       speechArticle.js
                                   │                             (bot chart image)
                                   │
  Frontend ──HTTP──> Express (app.js) ──> src/routes/api.js (/api/v1/*, rate-limited)
                          │                        │
                          │                        ├─ reads dataCache.getNewsCache()/getDrawsCache()
                          │                        │  (populated by rssParser/irccDrawScraper on a
                          │                        │   15-min interval, started at server boot)
                          │                        └─ /speeches/* reads MongoDB directly (already cheap)
                          │
                          └──> src/routes/health.js (/api/health, unversioned, unthrottled)

workerDBUpdater.js (standalone script, run on a schedule, not imported by app.js)
   └─ speechNewsParser.scrapeSpeechNews() (Puppeteer) ──> MongoDB (tg_speech_articles)
```

## Entry points

- **`app.js`** — the only long-running process. Boots Express, sets up CORS/rate-limiting/DB connection/cache refresh, registers the Telegram webhook (`bot.setWebHook`), mounts the API routers, and wires every bot `/command` to a handler. Most of the file (~700+ lines) is still the bot's command handlers and hardcoded FAQ copy; the API surface itself is thin here — just wiring — with the actual route logic in `src/routes/`.
- **`src/utils/workerDBUpdater.js`** — a standalone script, *not* imported by `app.js`. Run separately (e.g. via Heroku Scheduler) to scrape speech news and refresh the `tg_speech_articles` MongoDB collection. Invoke with `node src/utils/workerDBUpdater.js`.

## Module map

| Module | Responsibility |
|---|---|
| `app.js` | Express server bootstrap (CORS, rate limiting, DB connect, cache start, webhook), all `bot.onText`/`callback_query` command handlers, FAQ menu copy |
| `src/routes/api.js` | `/api/v1/*` — public read-only routes for news/draws/speeches. Rate-limited (100 req/15min/IP). Reads `dataCache` for news/draws, MongoDB for speeches |
| `src/routes/health.js` | `/api/health` — unversioned, unthrottled status check (DB connection + cache freshness) |
| `src/utils/dataCache.js` | In-process cache backing the API's news/draws routes. Refreshes every 15 min via `rssParser`/`irccDrawScraper`. Exposes a `_setCacheForTesting` seam used only by tests |
| `src/utils/httpResponse.js` | `sendJsonError(res, status, message)` — the single place every route sends error responses from, so none of them can accidentally leak a stack trace or raw exception message |
| `src/middleware/logger.js` | Logs each user interaction to console (and admin DM via `sendLogToPrimary`); `saveLogToFile` writes NDJSON logs to disk but isn't currently wired into any handler |
| `src/utils/rssParser.js` | Fetches the IRCC news RSS feed, plus pure filter functions (`filterItemsByMonth`, `filterItemsByKeyword`) shared by both the bot (live-fetch then filter) and the API (filters the cache) |
| `src/utils/irccDrawScraper.js` | Fetches/parses the IRCC Express Entry draw JSON, plus a pure `filterParsedDraws` shared the same way |
| `src/utils/irccDrawAnalyzer.js` | Computes a rolling-average CRS from parsed draw data |
| `src/utils/chartGenerator.js` | Renders the rolling-average CRS as a line chart image (via `chartjs-to-image`) — **bot-only**, the API returns raw JSON data points instead (see API.md) |
| `src/utils/speechNewsParser.js` | Puppeteer scraper for IRCC speech news; reads/writes the MongoDB `tg_speech_articles` collection |
| `src/utils/mongoDBConnect.js` | Shared `connectToDatabase`/`closeDatabaseConnection`/`isConnected` helpers, reading the full connection string from `MONGODB_URI`. All DB access should go through this module rather than calling `mongoose.connect` directly. `app.js` connects once at startup and keeps the connection alive for the process lifetime (routes don't open/close per request) |
| `src/utils/utils.js` | Small shared helpers: `formatDate`, and `classFilterMap` (draw-class filter codes, shared between `app.js`, `irccDrawScraper.js`, and `src/routes/api.js`) |
| `src/models/speechArticle.js` | Mongoose schema for stored speech articles |

## Data flow by feature

- **News**: bot (`/latest_news`, `/month`, `/search_news`, `/full`) → `rssParser.js` fetches the live IRCC RSS feed on every call. API (`/api/v1/news/*`) → filters the same feed, but from `dataCache` (refreshed every 15 min), never live in the request path.
- **Draws**: bot (`/last_draws`, `/draws`, `/filter_draws`) → `irccDrawScraper.js` fetches IRCC's public draw JSON on every call → optionally `irccDrawAnalyzer.js` + `chartGenerator.js` render a rolling-average CRS chart *image*, sent via `bot.sendPhoto`. API (`/api/v1/draws/*`) → same filtering logic against `dataCache`'s full draw history (~435 rounds), and `/rolling-average` returns raw JSON points instead of an image, sorted chronologically before analysis (the bot's chart path has a known alignment bug here — see Known limitations).
- **Speeches**: both the bot (`/latest_speech`) and the API (`/api/v1/speeches/latest`) read from MongoDB only (`speechNewsParser.getStoredSpeechArticles`), never scrape live. The data is populated separately by `workerDBUpdater.js`, which scrapes canada.ca with Puppeteer and replaces the entire collection (`deleteAllDocuments` + reinsert) on each run.
- **FAQ** (`/faq`, bot only): purely static, hardcoded message copy plus an inline-keyboard state machine in the `callback_query` handler in `app.js`. No external calls, no API equivalent.

## External dependencies

- **Telegram Bot API** via `node-telegram-bot-api`, webhook mode (not polling). `bot.setWebHook` is called once at startup using `APP_URL`/`DEV_URL` + `WEBHOOK_PATH`.
- **IRCC RSS feed** (`api.io.canada.ca`) — news.
- **IRCC draw JSON** (`www.canada.ca/.../ee_rounds_123_en.json`) — undocumented public endpoint, no auth.
- **canada.ca speech search page** — scraped with headless Chromium via Puppeteer (fragile: relies on specific CSS selectors like `article.item`, `h3.h5`).
- **MongoDB Atlas** — single collection (`tg_speech_articles`) for speech articles only. Connection string lives entirely in `MONGODB_URI` (see readme) — if it ever goes stale again (it has before, when the cluster was recreated), that's the one place to update.

## Configuration

All config is environment variables loaded via `dotenv` (see the readme for the full list). `DEV_MODE=true` swaps the live Telegram token/URL for `DEV_TG_TOKEN`/`DEV_URL`, so the same codebase can run against a separate dev bot without code changes. `FRONTEND_ORIGIN` controls CORS for the API (any `localhost` origin is always allowed regardless of this var, for local frontend dev).

## Testing

`npm test` runs Node's built-in test runner (`node --test`, no extra framework dependency). `test/unit/` covers the pure logic functions (filtering, validation, rolling average, the error-response helper); `test/routes/` covers the API routes end-to-end via `supertest`, mounting only the router (never `app.js`, so no live Telegram/DB/cache side effects run during tests) with fixture data injected through `dataCache._setCacheForTesting`. The bot's `bot.onText` handlers in `app.js` are not covered by automated tests — they're still the largest untested surface in the codebase.

## Known limitations / things to check on future reviews

- **Rolling-average chart alignment (bot only)**: `chartGenerator.js` sorts `drawData` and `analyzedData` independently before charting, but `analyzedData` (rolling averages) has fewer entries than `drawData` (raw draws). Chart.js pairs them by array index, so the x-axis labels (from `drawData`) don't line up with the rolling-average series. The API's `/api/v1/draws/rolling-average/:classCode` does **not** have this bug (it sorts chronologically before computing the average) — this is bot-chart-specific technical debt, not fixed there since it'd mean redesigning what the Telegram chart image looks like.
- **In-memory state doesn't survive restarts or scale across dynos**: both `dataCache.js` (news/draws) and `express-rate-limit`'s default store (rate-limit counters) live in process memory. A restart clears both (fine for the cache, which just re-populates; also fine for rate limits, which just reset). But if this ever runs on more than one Heroku dyno, each dyno would have its own independent cache and rate-limit counters — the cache would just mean redundant IRCC fetches, but the rate limit would effectively multiply the real limit by the dyno count. Not an issue at current scale; worth a shared store (e.g. Redis) if that changes.
- **Speeches route has no automated DB test**: `/api/v1/speeches/latest`'s success path isn't covered by `test/` — it needs a real or mocked MongoDB connection that isn't set up yet. See API.md's "Known gaps".
- **Speech scraper is selector-coupled**: `speechNewsParser.js` scrapes canada.ca by CSS selector (`article.item`, `h3.h5`, positional `p` tags). A markup change on that page silently breaks scraping — check for empty/garbled results if speech data looks stale.
- **`workerDBUpdater.js` fully replaces the speech collection** on every run (delete-all then reinsert) rather than diffing — a failed mid-run scrape could leave the collection empty until the next successful run.
- **Draw/news field names are unrenamed**: the API passes through the scraper's internal field names (`drawNumber`, `crs`, `class`, `subclass`) as-is rather than a frontend-friendlier shape — an explicit decision (see DEVELOPMENT_PLAN.md Decisions), not an oversight, made because no frontend exists yet to say what it'd actually want.
