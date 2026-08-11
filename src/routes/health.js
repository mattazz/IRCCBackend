import express from 'express';

import dataCache from '../utils/dataCache.js';
import mongoDBConnect from '../utils/mongoDBConnect.js';

/**
 * Unversioned on purpose: uptime monitors and load balancers expect a stable health
 * check URL that doesn't move when the data API's version changes.
 */
const router = express.Router();

router.get('/', (req, res) => {
    res.json({
        status: 'ok',
        database: mongoDBConnect.isConnected() ? 'connected' : 'disconnected',
        cache: {
            news: dataCache.getNewsCache().lastUpdated,
            draws: dataCache.getDrawsCache().lastUpdated
        }
    });
});

export default router;
