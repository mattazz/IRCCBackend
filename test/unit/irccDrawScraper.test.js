import test from 'node:test';
import assert from 'node:assert/strict';
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
