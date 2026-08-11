import rssParser from './rssParser.js';
import irccDrawScraper from './irccDrawScraper.js';

/**
 * In-process cache for data the /api/* routes serve. Refreshed on an interval instead of
 * per-request, so a spike in website traffic never turns into a spike of live IRCC scrapes
 * (see docs/DEVELOPMENT_PLAN.md, Phase 1). The Telegram bot handlers in app.js call
 * rssParser/irccDrawScraper directly and are unaffected by this cache.
 */

const NEWS_REFRESH_MS = 15 * 60 * 1000; // 15 minutes
const DRAWS_REFRESH_MS = 15 * 60 * 1000; // 15 minutes
const DRAWS_CACHE_DEPTH = 1000; // comfortably covers the full draw history (435 rounds as of writing)

let newsCache = { data: null, lastUpdated: null };
let drawsCache = { data: null, lastUpdated: null };

async function refreshNewsCache() {
    try {
        const feed = await rssParser.fetchFullIRCCFeed();
        newsCache = { data: feed.items, lastUpdated: new Date() };
        console.log(`[dataCache] News cache refreshed: ${feed.items.length} items`);
    } catch (error) {
        console.error('[dataCache] Failed to refresh news cache, keeping last-known-good data:', error);
    }
}

async function refreshDrawsCache() {
    try {
        const draws = await irccDrawScraper.parseDraws(DRAWS_CACHE_DEPTH);
        drawsCache = { data: draws, lastUpdated: new Date() };
        console.log(`[dataCache] Draws cache refreshed: ${draws.length} draws`);
    } catch (error) {
        console.error('[dataCache] Failed to refresh draws cache, keeping last-known-good data:', error);
    }
}

/**
 * Populates both caches immediately, then keeps them refreshed on an interval.
 * Call once at server startup.
 */
function startCacheRefresh() {
    refreshNewsCache();
    refreshDrawsCache();
    setInterval(refreshNewsCache, NEWS_REFRESH_MS);
    setInterval(refreshDrawsCache, DRAWS_REFRESH_MS);
}

/** @returns {{data: Array|null, lastUpdated: Date|null}} */
function getNewsCache() {
    return newsCache;
}

/** @returns {{data: Array|null, lastUpdated: Date|null}} */
function getDrawsCache() {
    return drawsCache;
}

export default { startCacheRefresh, getNewsCache, getDrawsCache };
