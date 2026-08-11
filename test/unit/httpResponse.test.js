import test from 'node:test';
import assert from 'node:assert/strict';
import httpResponse from '../../src/utils/httpResponse.js';

test('sendJsonError - sets the status code and a { error } body, nothing else', () => {
    let capturedStatus, capturedBody;
    const res = {
        status(code) { capturedStatus = code; return this; },
        json(body) { capturedBody = body; }
    };

    httpResponse.sendJsonError(res, 400, 'bad input');

    assert.equal(capturedStatus, 400);
    assert.deepEqual(capturedBody, { error: 'bad input' });
});
