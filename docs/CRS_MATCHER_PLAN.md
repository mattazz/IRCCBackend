# Development Plan: CRS Score & Draw Matcher API

Tracks the backend implementation for calculating Express Entry CRS score eligibility, draw qualification match rates, score gap analysis, and target recommendations against cached IRCC draw data.

## Goal

Provide a public read-only endpoint `GET /api/v1/draws/match` that accepts a candidate's CRS score, optional class code filter, and optional timeframe window to compute match rates, percentile ranking, and draw eligibility breakdown.

## Guiding Principles

- **Reuse cached data:** Reads directly from `dataCache.getDrawsCache()` — no live IRCC scraping in the request path.
- **Pure calculation layer:** Pure logic resides in `src/utils/irccDrawMatcher.js`, decoupled from Express middleware for easy unit testing.
- **Strict input validation:** Clamps parameters to valid ranges and safe defaults to protect server resources.

## Endpoint Specification

`GET /api/v1/draws/match?score=508&classCode=CEC&timeframeMonths=12`

### Query Parameters

| Parameter | Type | Required | Default | Constraint |
|---|---|---|---|---|
| `score` | integer | Yes | - | Must be between `1` and `1200` |
| `classCode` | string | No | All classes | Valid code from `utils.classFilterMap` (e.g. `CEC`, `STEM`, `FLP`, `GEN`) |
| `timeframeMonths` | integer | No | `12` | Clamped between `1` and `120` months |

### Response Shape

```json
{
  "userScore": 508,
  "classCode": "CEC",
  "className": "Canadian Experience Class",
  "timeframeMonths": 12,
  "totalDraws": 10,
  "qualifyingDrawsCount": 6,
  "matchRatePercentage": 60,
  "chanceLevel": "Moderate",
  "latestCutoff": 520,
  "averageCutoff": 512,
  "minCutoff": 495,
  "maxCutoff": 525,
  "scoreGapLatest": -12,
  "scoreGapAverage": -4,
  "percentileRank": 65,
  "recommendations": {
    "pointsToLatest": 12,
    "pointsToAverage": 4,
    "pointsTo75thPercentile": 15
  },
  "draws": [
    {
      "drawNumber": "310",
      "date": "July 15, 2024",
      "crs": "520",
      "class": "Canadian Experience Class",
      "drawSize": "3,000",
      "qualified": false,
      "gap": -12
    }
  ]
}
```

---

## Phases

### Phase 0 — Foundations & Matcher Core Module ✅
- [x] Create `src/utils/irccDrawMatcher.js` with export `calculateDrawMatch(draws, userScore, classCode, timeframeMonths)`
- [x] Unit tests in `test/unit/irccDrawMatcher.test.js` verifying cutoff filtering, match rate calculation, score deltas, and edge cases (zero draws, max scores, min scores).

### Phase 1 — Express API Route & Throttling ✅
- [x] Add route `GET /api/v1/draws/match` in `src/routes/api.js`.
- [x] Add parameter validation (400 responses for invalid `score` or unrecognized `classCode`).
- [x] Route tests in `test/routes/api.test.js` using Supertest over isolated mock router.

### Phase 2 — API Documentation Update ✅
- [x] Update `docs/API.md` documenting route parameters, response payloads, rate limits, and error scenarios.
