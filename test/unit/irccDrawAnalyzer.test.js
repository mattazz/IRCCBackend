import test from 'node:test';
import assert from 'node:assert/strict';
import irccDrawAnalyzer from '../../src/utils/irccDrawAnalyzer.js';

test('analyzeCRSRollingAverage - computes averages over the rolling window', () => {
    const draws = [
        { date: '2024-01-01', crs: '500' },
        { date: '2024-01-08', crs: '480' },
        { date: '2024-01-15', crs: '460' },
        { date: '2024-01-22', crs: '440' },
        { date: '2024-01-29', crs: '420' },
    ];
    const result = irccDrawAnalyzer.analyzeCRSRollingAverage(draws, 4);
    // 5 draws, window size 4 => 2 rolling windows
    assert.equal(result.length, 2);
    assert.equal(result[0].average, (500 + 480 + 460 + 440) / 4);
    assert.equal(result[1].average, (480 + 460 + 440 + 420) / 4);
});

test('analyzeCRSRollingAverage - returns an empty array when there is not enough data', () => {
    const draws = [{ date: '2024-01-01', crs: '500' }];
    const result = irccDrawAnalyzer.analyzeCRSRollingAverage(draws, 4);
    assert.deepEqual(result, []);
});

test('analyzeCRSRollingAverage - filters out non-numeric CRS values before averaging', () => {
    const draws = [
        { date: '2024-01-01', crs: '500' },
        { date: '2024-01-08', crs: 'N/A' }, // dropped
        { date: '2024-01-15', crs: '460' },
        { date: '2024-01-22', crs: '440' },
        { date: '2024-01-29', crs: '420' },
    ];
    const result = irccDrawAnalyzer.analyzeCRSRollingAverage(draws, 4);
    // 4 valid numeric points remain => exactly one window
    assert.equal(result.length, 1);
    assert.equal(result[0].average, (500 + 460 + 440 + 420) / 4);
});
