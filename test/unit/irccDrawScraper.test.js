import test from 'node:test';
import assert from 'node:assert/strict';
import axios from 'axios';
import irccDrawScraper from '../../src/utils/irccDrawScraper.js';

const fixtureDraws = [
    { date: '2024-01-01', drawNumber: '1', crs: '500', class: 'Canadian Experience Class', subclass: 'Canadian Experience Class', drawSize: '1000' },
    { date: '2024-02-01', drawNumber: '2', crs: '480', class: 'Provincial Nominee Program', subclass: 'Provincial Nominee Program', drawSize: '800' },
    { date: '2024-03-01', drawNumber: '3', crs: '470', class: 'No Program Specified', subclass: 'Canadian Experience Class, Federal Skilled Worker', drawSize: '3000' },
];

test('filterParsedDraws - matches the class field directly', () => {
    const [classFiltered] = irccDrawScraper.filterParsedDraws(fixtureDraws, 'CEC');
    assert.equal(classFiltered.length, 1);
    assert.equal(classFiltered[0].drawNumber, '1');
});

test('filterParsedDraws - falls back to subclass matches when class matches are few', () => {
    const [, subclassFiltered] = irccDrawScraper.filterParsedDraws(fixtureDraws, 'CEC');
    assert.ok(subclassFiltered.some(d => d.drawNumber === '3'));
});

test('filterParsedDraws - filter code is case-insensitive', () => {
    const [classFiltered] = irccDrawScraper.filterParsedDraws(fixtureDraws, 'cec');
    assert.equal(classFiltered.length, 1);
});

test('filterParsedDraws - unknown filter code returns empty results rather than throwing', () => {
    const [classFiltered, subclassFiltered] = irccDrawScraper.filterParsedDraws(fixtureDraws, 'ZZZ');
    assert.deepEqual(classFiltered, []);
    assert.deepEqual(subclassFiltered, []);
});

test('parseDraws - poolDistribution is a clean, non-overlapping 15-bracket partition of dd1-dd17', async (t) => {
    const rawRound = {
        drawDate: '2024-07-15',
        drawNumber: '310',
        drawCRS: '520',
        drawName: 'Canadian Experience Class',
        drawText2: '',
        drawSize: '3,000',
        drawCutOff: 'July 1, 2024 at 00:00:00 UTC',
        drawDateTime: '2024-07-15T00:00:00',
        drawDistributionAsOn: 'July 10, 2024',
        dd1: '500', dd2: '19705', dd3: '11111', dd4: '73099', dd5: '40000',
        dd6: '30000', dd7: '25000', dd8: '20000', dd9: '22222', dd10: '15000',
        dd11: '12000', dd12: '10000', dd13: '9000', dd14: '8000', dd15: '20000',
        dd16: '15000', dd17: '10000', dd18: '229100',
    };

    t.mock.method(axios, 'get', async () => ({ data: { rounds: [rawRound] } }));

    const [draw] = await irccDrawScraper.parseDraws(1);

    // Exactly 15 brackets - dd3 and dd9 (which overlapped "451-500"/"401-450" with the real
    // dd8/dd10 brackets) must not appear as their own keys.
    const keys = Object.keys(draw.poolDistribution);
    assert.equal(keys.length, 15);
    assert.ok(!keys.includes('451-500'), 'dd3 should not be exposed under the overlapping "451-500" label');
    assert.ok(!keys.includes('401-450'), 'dd9 should not be exposed under the overlapping "401-450" label');

    // Brackets partition 0-1200 with no gaps or overlaps.
    assert.deepEqual(keys, [
        '601-1200', '501-600', '491-500', '481-490', '471-480', '461-470', '451-460',
        '441-450', '431-440', '421-430', '411-420', '401-410', '351-400', '301-350', '0-300',
    ]);

    // dd4/dd10 (the real 491-500/441-450 brackets) are still wired up correctly.
    assert.equal(draw.poolDistribution['491-500'], '73099');
    assert.equal(draw.poolDistribution['441-450'], '15000');
    assert.equal(draw.poolTotal, '229100');
});
