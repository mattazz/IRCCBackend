import express from 'express';

import dataCache from '../utils/dataCache.js';
import mongoDBConnect from '../utils/mongoDBConnect.js';
import rssParser from '../utils/rssParser.js';
import irccDrawScraper from '../utils/irccDrawScraper.js';
import irccDrawAnalyzer from '../utils/irccDrawAnalyzer.js';
import speechNewsParser from '../utils/speechNewsParser.js';
import utils from '../utils/utils.js';
import httpResponse from '../utils/httpResponse.js';

const { sendJsonError } = httpResponse;
const router = express.Router();

router.get('/health', (req, res) => {
    res.json({
        status: 'ok',
        database: mongoDBConnect.isConnected() ? 'connected' : 'disconnected',
        cache: {
            news: dataCache.getNewsCache().lastUpdated,
            draws: dataCache.getDrawsCache().lastUpdated
        }
    });
});

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

    const count = parseInt(req.query.count, 10) || 5;
    res.json(data.slice(0, count));
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
    const count = parseInt(req.query.count, 10) || 10;
    try {
        const articles = await speechNewsParser.getStoredSpeechArticles();
        res.json(articles.slice(0, count));
    } catch (error) {
        console.error('[api] Error fetching speeches:', error);
        sendJsonError(res, 500, 'Error fetching speech articles');
    }
});

export default router;
