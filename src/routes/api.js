import express from 'express';
import rateLimit from 'express-rate-limit';

import dataCache from '../utils/dataCache.js';
import rssParser from '../utils/rssParser.js';
import irccDrawScraper from '../utils/irccDrawScraper.js';
import irccDrawAnalyzer from '../utils/irccDrawAnalyzer.js';
import speechNewsParser from '../utils/speechNewsParser.js';
import utils from '../utils/utils.js';
import httpResponse from '../utils/httpResponse.js';

const { sendJsonError } = httpResponse;
const router = express.Router();

const MAX_LIST_COUNT = 100;
const MAX_KEYWORD_LENGTH = 100;

/**
 * Parses a "count"-style query param into a positive integer, falling back to
 * defaultValue on anything invalid (missing, non-numeric, zero, negative) and
 * capping at MAX_LIST_COUNT so a single request can't ask for an unbounded slice.
 */
function parsePositiveIntParam(value, defaultValue) {
    const parsed = parseInt(value, 10);
    if (!Number.isInteger(parsed) || parsed <= 0) return defaultValue;
    return Math.min(parsed, MAX_LIST_COUNT);
}

// Public read-only API - throttle per IP to protect this server from abuse.
// Health lives on its own unversioned router (src/routes/health.js), so it isn't
// covered by this limiter or by the /v1 prefix.
router.use(rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Too many requests, please try again later.' }
}));

/**
 * News
 * Note: the specific routes (/news/latest, /news/full, /news/search) must be registered
 * before the catch-all /news/:month, otherwise Express would match "latest"/"full"/"search"
 * as a :month param instead.
 */

router.get('/news/latest', (req, res) => {
    const { data } = dataCache.getNewsCache();
    if (!data) return sendJsonError(res, 503, 'News cache is still warming up, try again shortly');

    const currentMonthName = new Date().toLocaleString('default', { month: 'long' });
    const monthNum = rssParser.validateUserMonthInput(currentMonthName);
    res.json(rssParser.filterItemsByMonth(data, monthNum));
});

router.get('/news/full', (req, res) => {
    const { data } = dataCache.getNewsCache();
    if (!data) return sendJsonError(res, 503, 'News cache is still warming up, try again shortly');
    res.json(data);
});

router.get('/news/search', (req, res) => {
    const { data } = dataCache.getNewsCache();
    if (!data) return sendJsonError(res, 503, 'News cache is still warming up, try again shortly');

    const keyword = req.query.q;
    if (!keyword) return sendJsonError(res, 400, 'Query parameter "q" is required, e.g. /api/news/search?q=Express+Entry');
    if (keyword.length > MAX_KEYWORD_LENGTH) return sendJsonError(res, 400, `Query parameter "q" must be ${MAX_KEYWORD_LENGTH} characters or fewer`);

    res.json(rssParser.filterItemsByKeyword(data, keyword));
});

router.get('/news/:month', (req, res) => {
    const { data } = dataCache.getNewsCache();
    if (!data) return sendJsonError(res, 503, 'News cache is still warming up, try again shortly');

    try {
        const monthNum = rssParser.validateUserMonthInput(req.params.month);
        res.json(rssParser.filterItemsByMonth(data, monthNum));
    } catch (error) {
        sendJsonError(res, 400, 'Invalid month - use a full month name, e.g. /api/news/January');
    }
});

/**
 * Draws
 */

router.get('/draws/latest', (req, res) => {
    const { data } = dataCache.getDrawsCache();
    if (!data) return sendJsonError(res, 503, 'Draws cache is still warming up, try again shortly');

    const count = parsePositiveIntParam(req.query.count, 5);
    res.json(data.slice(0, count));
});

router.get('/draws/all', (req, res) => {
    const { data } = dataCache.getDrawsCache();
    if (!data) return sendJsonError(res, 503, 'Draws cache is still warming up, try again shortly');

    // Chronological (oldest -> newest), same convention as /draws/rolling-average, since the
    // main consumer of the full history is client-side charting rather than a "recent" list.
    const chronologicalDraws = [...data].sort((a, b) => new Date(a.date) - new Date(b.date));
    res.json(chronologicalDraws);
});

router.get('/draws/filter/:classCode', (req, res) => {
    const { data } = dataCache.getDrawsCache();
    if (!data) return sendJsonError(res, 503, 'Draws cache is still warming up, try again shortly');

    const classCode = req.params.classCode.toUpperCase();
    if (!utils.classFilterMap[classCode]) {
        return sendJsonError(res, 400, `Invalid class code. Valid codes: ${Object.keys(utils.classFilterMap).join(', ')}`);
    }

    const [classFiltered, subclassFiltered] = irccDrawScraper.filterParsedDraws(data, classCode);
    res.json({
        classCode,
        className: utils.classFilterMap[classCode],
        draws: classFiltered,
        subclassDraws: subclassFiltered
    });
});

router.get('/draws/rolling-average/:classCode', (req, res) => {
    const { data } = dataCache.getDrawsCache();
    if (!data) return sendJsonError(res, 503, 'Draws cache is still warming up, try again shortly');

    const classCode = req.params.classCode.toUpperCase();
    if (!utils.classFilterMap[classCode]) {
        return sendJsonError(res, 400, `Invalid class code. Valid codes: ${Object.keys(utils.classFilterMap).join(', ')}`);
    }

    const [classFiltered] = irccDrawScraper.filterParsedDraws(data, classCode);
    // Chronological (oldest -> newest) order, unlike the raw cache, so the rolling average
    // lines up correctly against draw dates for the frontend to chart.
    const chronologicalDraws = [...classFiltered].sort((a, b) => new Date(a.date) - new Date(b.date));
    const rollingAverage = irccDrawAnalyzer.analyzeCRSRollingAverage(chronologicalDraws);

    res.json({
        classCode,
        className: utils.classFilterMap[classCode],
        draws: chronologicalDraws,
        rollingAverage
    });
});

/**
 * Speeches
 */

router.get('/speeches/latest', async (req, res) => {
    const count = parsePositiveIntParam(req.query.count, 10);
    try {
        const articles = await speechNewsParser.getStoredSpeechArticles();
        res.json(articles.slice(0, count));
    } catch (error) {
        console.error('[api] Error fetching speeches:', error);
        sendJsonError(res, 500, 'Error fetching speech articles');
    }
});

export default router;
