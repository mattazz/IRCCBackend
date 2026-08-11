# Development Plan: Website-Facing API

Tracks the work to expose this backend's data (news, draws, speeches) to a website frontend via a JSON API, alongside the existing Telegram bot. See [ARCHITECTURE.md](ARCHITECTURE.md) for how the codebase is currently organized.

## Goal

Let a frontend website call this backend directly (`GET /api/...` → JSON) for the same data the Telegram bot already serves, without breaking or duplicating the bot.

## Guiding principles

- **Reuse, don't fork.** `rssParser`, `irccDrawScraper`, `irccDrawAnalyzer`, `speechNewsParser` are already Telegram-agnostic — they return data, they don't know about `bot`/`chatId`. New API routes should call the *same* functions the bot handlers call, not copies.
- **The bot keeps working throughout.** This is additive. No phase should require pausing or breaking `/latest_news`, `/draws`, etc.
- **Don't expose what isn't safe to expose at request-time.** Live scraping (Puppeteer speech scrape) stays an offline job; only pre-fetched/cached data gets a synchronous HTTP endpoint.

## Architecture decision: one process or two?

**Recommendation: keep one Express app** (extend `app.js`) rather than splitting into a separate API service.

| | One process (recommended) | Separate API service |
|---|---|---|
| Deploy | Same Heroku dyno, same `Procfile.txt`, no new infra | New app to provision, deploy, and pay for |
| Risk | A bug in an API route can't crash the bot process any more than any other bug in `app.js` today | Fully isolated — a bad API route can't affect webhook handling |
| Effort | Small — add routes to the existing Express app | Larger — new project, new env config, new deploy pipeline |

Revisit this only if the API needs independent scaling (e.g. Puppeteer load) or a different deploy cadence than the bot. Not the case yet.

## Decisions

Resolved up front so the phases below can be built without re-litigating them mid-implementation:

1. **Auth**: `/api/*` is fully public and read-only. No API key.
2. **Throttling**: wanted, and treated as part of getting endpoints "live-ready" rather than a later nice-to-have — see Phase 3.
3. **Frontend origin(s) for CORS**: no frontend domain exists yet, so `FRONTEND_ORIGIN` defaults to `http://localhost:*` for local dev. Update this env var (comma-separated list supported) once a real domain/staging URLs exist — this is a config change, not a code change, so it isn't a blocker for building the API itself.
4. **Chart data**: `/api/draws/rolling-average/:classCode` returns raw JSON data points (dates + averages), not a rendered image. The frontend charts it dynamically. `chartGenerator.js` (Telegram's PNG chart) stays as-is for the bot; it's not reused here.
5. **Draws freshness**: live-scrape-per-request is *not* acceptable for the public API. Caching lands before the news/draws endpoints are considered done — see reordering below.

## Phases

### Phase 0 — Foundations ✅
- [x] Add `cors` middleware (already an unused dependency in `package.json`), reading allowed origins from `FRONTEND_ORIGIN` (see Decision 3) — `app.js`, always allows any `localhost` origin
- [x] Switch `mongoDBConnect` usage from connect-per-request to a single connection opened once at server startup (`app.js`) and reused
- [x] Add a standard JSON error shape (`{ error: string }`) and a `sendJsonError(res, status, message)` helper in `app.js` — not yet called anywhere, wired in during Phase 2
- [x] Add a `GET /api/health` route (checks DB connectivity + cache freshness)
- Bonus: also moved the Mongo connection string to a single `MONGODB_URI` env var (was hardcoded host/user in source) after the old cluster's DNS went stale — see readme's env var table

### Phase 1 — Caching layer (built before the endpoints that depend on it) ✅
Per Decision 5, news and draws endpoints must not scrape IRCC live on every request. Build the cache first so Phase 2 endpoints read from it from day one, rather than shipping live-scrape endpoints and retrofitting caching later.

- [x] Added `src/utils/dataCache.js` — refreshes news (`rssParser.fetchFullIRCCFeed`) and draws (`irccDrawScraper.parseDraws`, full ~435-round history) on a 15-minute interval, module-level cache with `lastUpdated` timestamp. Started via `dataCache.startCacheRefresh()` at server boot in `app.js`
- [x] Refresh interval: 15 minutes for both, to start — easy to split/tune later if traffic shows a need
- [x] Cache refresh failures log and keep the last-known-good data rather than clearing the cache
- [x] Speeches: no change needed, already DB-backed

Handled: routes below return a `503` (via the shared `sendJsonError` helper) if a request lands before the first refresh completes or after a refresh failure, instead of crashing on `null` data.

Exit criteria: news and draws data is available in-process without a live IRCC call in the request path. ✅

### Phase 2 — Read-only endpoints ✅
All routes live in `src/routes/api.js`, mounted at `/api` in `app.js`. Each reads from the Phase 1 cache (news/draws) or MongoDB (speeches) — no live scraping in the request path.

> Note: Phase 4 added versioning. As of Phase 4, these data routes are mounted at `/api/v1/...` (not `/api/...` as written below), and `/api/health` moved to its own unversioned router (`src/routes/health.js`). See [API.md](API.md) for the current, authoritative paths.

- [x] `GET /api/news/latest` → latest month, from cache
- [x] `GET /api/news/:month` → filtered from cached full feed (validate via `rssParser.validateUserMonthInput`, 400 on invalid month)
- [x] `GET /api/news/search?q=keyword` → filtered from cached full feed
- [x] `GET /api/news/full` → cached full feed
- [x] `GET /api/draws/latest?count=5` → from cached draws (most-recent-first)
- [x] `GET /api/draws/filter/:classCode` → `{ classCode, className, draws, subclassDraws }` from cached draws (400 on unknown code, reuse `utils.classFilterMap`)
- [x] `GET /api/draws/rolling-average/:classCode` → `{ classCode, className, draws, rollingAverage }`, draws sorted chronologically before computing the average (see Decision 4, and the chart-alignment issue noted in `ARCHITECTURE.md` — this endpoint doesn't have that bug since it sorts before analyzing, unlike the Telegram chart path)
- [x] `GET /api/speeches/latest?count=10` → `speechNewsParser.getStoredSpeechArticles()`
- [x] `GET /api/health` → moved here from `app.js` (was added inline in Phase 0)

Also extracted pure filtering functions so the bot and the API share logic instead of duplicating it: `rssParser.filterItemsByMonth`/`filterItemsByKeyword`, `irccDrawScraper.filterParsedDraws`. `sendJsonError` moved to `src/utils/httpResponse.js` so both `app.js` and the new router can use it.

Exit criteria: a frontend can fetch every data type the bot can send, as JSON, with no Telegram dependency and no per-request scrape. ✅

### Phase 3 — Hardening ✅
- [x] Rate limiting on `/api/*` via `express-rate-limit` — 100 requests / 15 min per IP, `/health` exempt (monitoring pings shouldn't count). Also added `app.set('trust proxy', 1)` in `app.js`, required for the limiter to see real client IPs (and not just Heroku's router IP) once this is deployed there
- [x] Input validation: `count` query params (`draws/latest`, `speeches/latest`) now clamp to 1–100 via a shared `parsePositiveIntParam` helper in `src/routes/api.js` instead of silently accepting anything; `news/search`'s `q` param now has a max length (100 chars). Month names and class codes were already validated in Phase 2
- [x] Response shape: dropped Mongoose's internal `__v` field from the speeches query (`speechNewsParser.js`, via projection). Kept `_id` (useful as a frontend list key) and left the draw field names (`drawNumber`/`crs`/`class`/`subclass`/`drawSize`) as-is — no frontend exists yet to say what it'd actually want renamed, and these already match what the Telegram bot exposes. Revisit if the frontend build surfaces a concrete need.

### Phase 4 — Docs & contract ✅
- [x] Documented the full API surface in [API.md](API.md) — every route, params, response shapes, error cases, rate limit, cache behavior
- [x] Versioned now: data routes moved from `/api/...` to `/api/v1/...` (`src/routes/api.js`, mounted in `app.js`). `/api/health` stayed unversioned on its own router (`src/routes/health.js`) — health checks/uptime monitors shouldn't have to change URL when the data API version bumps

### Phase 5 — Testing & observability ✅
- [x] `npm test` now runs Node's built-in test runner (`node --test`) — no new test framework dependency needed (Node 26 here). 27 tests: unit tests for the pure logic (`rssParser`, `irccDrawScraper.filterParsedDraws`, `irccDrawAnalyzer`, `httpResponse.sendJsonError`) plus route-level tests (`test/routes/`) using `supertest` against an isolated app that mounts only the router — never imports `app.js`, so no Telegram/DB/live-cache side effects fire during tests. Cache-backed routes are seeded via `dataCache._setCacheForTesting`, a test-only seam (not called by application code)
- [x] Confirmed error responses never leak stack traces/internals: every route uses the shared `sendJsonError(res, status, message)` helper, which only ever sends `{ error: message }` — verified directly in `test/unit/httpResponse.test.js`, which by construction covers every current and future call site
- [ ] Not covered: `/api/v1/speeches/latest`'s success path has no automated test — it depends on a live/mocked MongoDB connection, which isn't set up yet (would need something like `mongodb-memory-server`, or refactor to inject the model). Documented as a known gap in [API.md](API.md) rather than skipped silently

## Still open

- Exact `FRONTEND_ORIGIN` value(s) — fill in once the frontend has a real domain (see Decision 3).
- Cache refresh interval for news/draws — start with a reasonable default in Phase 1, tune based on real traffic.
- Automated DB-backed test coverage for `/api/v1/speeches/latest` (see Phase 5).

## Non-goals (for now)

- Rewriting the Telegram bot to consume the new API instead of calling modules directly — no benefit, adds a network hop for no reason.
- Splitting into microservices — revisit only if Phase 3+ traffic actually demands it.
