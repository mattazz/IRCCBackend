import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import request from 'supertest';

import apiRouter from '../../src/routes/api.js';
import dataCache from '../../src/utils/dataCache.js';

/**
 * Mounts only the API router (not app.js) so these tests never trigger app.js's
 * startup side effects (Telegram webhook registration, live DB connect, live cache
 * refresh). Cache data is seeded directly via dataCache._setCacheForTesting instead
 * of hitting IRCC.
 */
function buildTestApp() {
    const app = express();
    app.use('/api/v1', apiRouter);
    return app;
}

const currentYear = new Date().getFullYear();
const fixtureNews = [
    { title: 'January news', summary: 'about Express Entry', pubDate: new Date(currentYear, 0, 10).toISOString(), link: 'https://example.com/1' },
    { title: 'February news', summary: 'other topic', pubDate: new Date(currentYear, 1, 10).toISOString(), link: 'https://example.com/2' },
];

const fixtureDraws = [
    { date: '2024-03-01', drawNumber: '3', crs: '470', class: 'Canadian Experience Class', subclass: 'Canadian Experience Class', drawSize: '3000' },
    { date: '2024-02-01', drawNumber: '2', crs: '480', class: 'Provincial Nominee Program', subclass: 'Provincial Nominee Program', drawSize: '800' },
    { date: '2024-01-01', drawNumber: '1', crs: '500', class: 'Canadian Experience Class', subclass: 'Canadian Experience Class', drawSize: '1000' },
];

test.before(() => {
    dataCache._setCacheForTesting({ news: fixtureNews, draws: fixtureDraws });
});

test('GET /api/v1/news/full returns the cached feed', async () => {
    const res = await request(buildTestApp()).get('/api/v1/news/full');
    assert.equal(res.status, 200);
    assert.equal(res.body.length, 2);
});

test('GET /api/v1/news/:month filters to that month', async () => {
    const res = await request(buildTestApp()).get('/api/v1/news/January');
    assert.equal(res.status, 200);
    assert.equal(res.body.length, 1);
    assert.equal(res.body[0].title, 'January news');
});

test('GET /api/v1/news/:month with an invalid month returns 400, not a crash', async () => {
    const res = await request(buildTestApp()).get('/api/v1/news/NotAMonth');
    assert.equal(res.status, 400);
    assert.ok(res.body.error);
});

test('GET /api/v1/news/search without q returns 400', async () => {
    const res = await request(buildTestApp()).get('/api/v1/news/search');
    assert.equal(res.status, 400);
});

test('GET /api/v1/news/search with q over the length limit returns 400', async () => {
    const res = await request(buildTestApp()).get('/api/v1/news/search').query({ q: 'a'.repeat(101) });
    assert.equal(res.status, 400);
});

test('GET /api/v1/news/search finds matches', async () => {
    const res = await request(buildTestApp()).get('/api/v1/news/search').query({ q: 'express' });
    assert.equal(res.status, 200);
    assert.equal(res.body.length, 1);
});

test('GET /api/v1/draws/latest respects the count param', async () => {
    const res = await request(buildTestApp()).get('/api/v1/draws/latest').query({ count: 2 });
    assert.equal(res.status, 200);
    assert.equal(res.body.length, 2);
});

test('GET /api/v1/draws/latest ignores an invalid count and falls back to the default', async () => {
    const res = await request(buildTestApp()).get('/api/v1/draws/latest').query({ count: 'not-a-number' });
    assert.equal(res.status, 200);
    assert.equal(res.body.length, 3); // fixture only has 3, default is 5
});

test('GET /api/v1/draws/all returns the full history, chronologically sorted', async () => {
    const res = await request(buildTestApp()).get('/api/v1/draws/all');
    assert.equal(res.status, 200);
    assert.equal(res.body.length, 3); // all 3 fixture draws, not capped
    assert.equal(res.body[0].date, '2024-01-01'); // oldest first
    assert.equal(res.body[2].date, '2024-03-01'); // newest last
});

test('GET /api/v1/draws/filter/:classCode returns filtered draws', async () => {
    const res = await request(buildTestApp()).get('/api/v1/draws/filter/CEC');
    assert.equal(res.status, 200);
    assert.equal(res.body.classCode, 'CEC');
    assert.equal(res.body.draws.length, 2);
});

test('GET /api/v1/draws/filter/:classCode with an invalid code returns 400', async () => {
    const res = await request(buildTestApp()).get('/api/v1/draws/filter/ZZZ');
    assert.equal(res.status, 400);
    assert.ok(res.body.error);
});

test('GET /api/v1/draws/rolling-average/:classCode returns chronologically-sorted draws', async () => {
    const res = await request(buildTestApp()).get('/api/v1/draws/rolling-average/CEC');
    assert.equal(res.status, 200);
    assert.equal(res.body.draws[0].date, '2024-01-01'); // oldest first, not cache order
    assert.equal(res.body.draws[1].date, '2024-03-01');
    assert.ok(Array.isArray(res.body.rollingAverage));
});

test('GET /api/v1/draws/rolling-average/:classCode with an invalid code returns 400', async () => {
    const res = await request(buildTestApp()).get('/api/v1/draws/rolling-average/ZZZ');
    assert.equal(res.status, 400);
});
