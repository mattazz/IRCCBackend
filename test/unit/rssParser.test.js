import test from 'node:test';
import assert from 'node:assert/strict';
import rssParser from '../../src/utils/rssParser.js';

test('validateUserMonthInput - valid full month name returns month number', () => {
    assert.equal(rssParser.validateUserMonthInput('January'), 0);
    assert.equal(rssParser.validateUserMonthInput('december'), 11);
});

test('validateUserMonthInput - abbreviations are accepted', () => {
    assert.equal(rssParser.validateUserMonthInput('Jan'), 0);
});

test('validateUserMonthInput - "string" return type returns the lowercased input', () => {
    assert.equal(rssParser.validateUserMonthInput('January', 'string'), 'january');
});

test('validateUserMonthInput - invalid month throws', () => {
    assert.throws(() => rssParser.validateUserMonthInput('Notamonth'), /Invalid Month/);
});

test('filterItemsByMonth - keeps only items in the given month of the current year', () => {
    const currentYear = new Date().getFullYear();
    const items = [
        { title: 'A', pubDate: new Date(currentYear, 0, 15).toISOString() }, // January, this year
        { title: 'B', pubDate: new Date(currentYear, 1, 15).toISOString() }, // February, this year
        { title: 'C', pubDate: new Date(currentYear - 1, 0, 15).toISOString() }, // January, last year
    ];
    const result = rssParser.filterItemsByMonth(items, 0);
    assert.equal(result.length, 1);
    assert.equal(result[0].title, 'A');
});

test('filterItemsByKeyword - matches title or summary, case-insensitive', () => {
    const items = [
        { title: 'Express Entry news', summary: 'something' },
        { title: 'Other', summary: 'about EXPRESS entry program' },
        { title: 'Unrelated', summary: 'nothing here' },
    ];
    const result = rssParser.filterItemsByKeyword(items, 'express entry');
    assert.equal(result.length, 2);
});
