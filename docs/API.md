# API Reference

Public, read-only JSON API for the frontend. See [DEVELOPMENT_PLAN.md](DEVELOPMENT_PLAN.md) for the decisions and phases behind this, and [ARCHITECTURE.md](ARCHITECTURE.md) for how it fits into the rest of the codebase.

Base URL: `<APP_URL or DEV_URL>` (see the [readme](../readme.MD) for env var setup). Locally, `http://localhost:3000`.

## Conventions

- All data routes are versioned under `/api/v1/...`. The health check is unversioned (`/api/health`) since it's an infrastructure endpoint, not part of the data contract.
- All responses are JSON.
- Errors are always `{ "error": "<message>" }` with a `4xx`/`5xx` status — never a stack trace or raw exception message.
- News and draws data comes from an in-process cache refreshed every 15 minutes (see `src/utils/dataCache.js`), not fetched live per request. A route returns `503` if a request arrives before the first refresh completes.
- Rate limit: 100 requests / 15 minutes per IP on `/api/v1/*` (not applied to `/api/health`). Exceeding it returns `429` with standard `RateLimit-*` response headers.

## `GET /api/health`

Unversioned. Reports server/DB/cache status - useful for uptime checks.

```json
{
  "status": "ok",
  "database": "connected",
  "cache": {
    "news": "2026-08-11T04:44:24.942Z",
    "draws": "2026-08-11T04:44:25.816Z"
  }
}
```

`database` is `"connected"` or `"disconnected"`. `cache.news`/`cache.draws` are the timestamp of the last successful refresh, or `null` if it hasn't populated yet.

## News

### `GET /api/v1/news/latest`

News items published in the current month.

### `GET /api/v1/news/:month`

News items published in the given month (current year), e.g. `/api/v1/news/January`.

- `400` if `:month` isn't a recognized month name/abbreviation.

### `GET /api/v1/news/search?q=<keyword>`

News items whose title or summary contains `q` (case-insensitive).

- `400` if `q` is missing or longer than 100 characters.

### `GET /api/v1/news/full`

The entire cached feed (most recent 50 items from IRCC's news feed).

**Response shape** (all news routes return an array of these):

```json
[
  {
    "title": "string",
    "link": "https://...",
    "pubDate": "2026-07-29T17:20:00.000Z",
    "summary": "string",
    "...": "other fields passed through from the RSS feed as-is"
  }
]
```

## Draws

### `GET /api/v1/draws/latest?count=<n>`

The `n` most recent Express Entry draws (most recent first). `count` defaults to 5, clamps to 1–100, and falls back to the default on invalid input (non-numeric, zero, negative).

```json
[
  {
    "date": "2026-08-07",
    "drawNumber": "434",
    "crs": "470",
    "class": "Transport Occupations, 2026-Version 2",
    "subclass": "Federal Skilled Worker Program, Canadian Experience Class and Federal Skilled Trades Program",
    "drawSize": "300"
  }
]
```

### `GET /api/v1/draws/filter/:classCode`

Draws matching a class filter code.

- `400` if `:classCode` isn't one of: `CEC`, `FSW`, `FST`, `PNP`, `FLP`, `TO`, `HO`, `STEM`, `GEN`, `TRAN`, `AGRI`.

```json
{
  "classCode": "CEC",
  "className": "Canadian Experience Class",
  "draws": [ /* draws matching the class field, cache order (most recent first) */ ],
  "subclassDraws": [ /* draws matching only the subclass field - only populated if draws has fewer than 10 results */ ]
}
```

### `GET /api/v1/draws/rolling-average/:classCode`

Same class-code validation as above. Returns the filtered draws **sorted chronologically** (oldest → newest, unlike `/draws/filter` and `/draws/latest`) plus a rolling CRS average computed over that sorted list, so the frontend can chart both series against the same date axis without the misalignment issue noted in `ARCHITECTURE.md` for the Telegram bot's chart.

```json
{
  "classCode": "CEC",
  "className": "Canadian Experience Class",
  "draws": [ /* chronological */ ],
  "rollingAverage": [
    { "date": "2015-02-20", "average": 512.25 }
  ]
}
```

`rollingAverage` is a 4-draw rolling window (see `irccDrawAnalyzer.analyzeCRSRollingAverage`) and will be an empty array if there are fewer than 4 matching draws.

## Speeches

### `GET /api/v1/speeches/latest?count=<n>`

The `n` most recently stored official speech articles, from MongoDB (populated by `workerDBUpdater.js`, not scraped live). `count` defaults to 10, clamps to 1–100.

```json
[
  {
    "_id": "6a7aa91123c46acf127c8ecf",
    "title": "string",
    "url": "https://...",
    "date": "2026-02-18T00:00:00.000Z",
    "summary": "string"
  }
]
```

Returns `[]` (not an error) if the collection is empty or hasn't been populated yet.

## Known gaps

- No automated test covers `/api/v1/speeches/latest` against a real/mocked database yet (see `docs/DEVELOPMENT_PLAN.md` Phase 5) - it's exercised manually and via `test/routes/api.test.js` for the other routes, which seed the cache directly instead of hitting Mongo.
- No API key / auth - this is intentionally public and read-only (see Decision 1 in the dev plan).
