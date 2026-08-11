import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import request from 'supertest';

import healthRouter from '../../src/routes/health.js';

test('GET /api/health returns status/database/cache fields', async () => {
    const app = express();
    app.use('/api/health', healthRouter);

    const res = await request(app).get('/api/health');
    assert.equal(res.status, 200);
    assert.equal(res.body.status, 'ok');
    assert.ok('database' in res.body);
    assert.ok('cache' in res.body);
});
