import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { calculateDrawMatch } from '../../src/utils/irccDrawMatcher.js';

const mockDraws = [
    { drawNumber: '310', date: 'July 15, 2024', crs: '520', class: 'Canadian Experience Class', subclass: '', drawSize: '3,000' },
    { drawNumber: '304', date: 'May 31, 2024', crs: '500', class: 'Canadian Experience Class', subclass: '', drawSize: '3,000' },
    { drawNumber: '298', date: 'April 24, 2024', crs: '495', class: 'Canadian Experience Class', subclass: '', drawSize: '3,000' },
    { drawNumber: '292', date: 'March 12, 2024', crs: '525', class: 'Canadian Experience Class', subclass: '', drawSize: '3,000' },
    { drawNumber: '280', date: 'January 10, 2023', crs: '480', class: 'French language proficiency', subclass: '', drawSize: '1,500' },
];

describe('irccDrawMatcher - calculateDrawMatch', () => {
    it('throws error for invalid user score', () => {
        assert.throws(() => calculateDrawMatch(mockDraws, 'invalid'), /Invalid user score/);
        assert.throws(() => calculateDrawMatch(mockDraws, 0), /Invalid user score/);
        assert.throws(() => calculateDrawMatch(mockDraws, 1250), /Invalid user score/);
    });

    it('calculates match rate correctly when user score qualifies for some draws', () => {
        const result = calculateDrawMatch(mockDraws, 508, 'CEC', 0);

        assert.equal(result.userScore, 508);
        assert.equal(result.classCode, 'CEC');
        assert.equal(result.className, 'Canadian Experience Class');
        assert.equal(result.totalDraws, 4); // 4 CEC draws
        assert.equal(result.qualifyingDrawsCount, 2); // 500 and 495
        assert.equal(result.matchRatePercentage, 50);
        assert.equal(result.chanceLevel, 'Moderate');
        assert.equal(result.latestCutoff, 520);
        assert.equal(result.scoreGapLatest, -12);
        assert.equal(result.recommendations.pointsToLatest, 12);
    });

    it('returns High chance level when user score qualifies for >70% of draws', () => {
        const result = calculateDrawMatch(mockDraws, 530, 'CEC', 0);

        assert.equal(result.qualifyingDrawsCount, 4);
        assert.equal(result.matchRatePercentage, 100);
        assert.equal(result.chanceLevel, 'High');
        assert.equal(result.scoreGapLatest, 10);
        assert.equal(result.recommendations.pointsToLatest, 0);
    });

    it('returns Unlikely chance level when user score qualifies for no draws', () => {
        const result = calculateDrawMatch(mockDraws, 450, 'CEC', 0);

        assert.equal(result.qualifyingDrawsCount, 0);
        assert.equal(result.matchRatePercentage, 0);
        assert.equal(result.chanceLevel, 'Unlikely');
    });

    it('returns zero stats when no draws match the given filter', () => {
        const result = calculateDrawMatch([], 500, 'AGRI', 12);

        assert.equal(result.totalDraws, 0);
        assert.equal(result.qualifyingDrawsCount, 0);
        assert.equal(result.matchRatePercentage, 0);
        assert.equal(result.chanceLevel, 'Unlikely');
        assert.equal(result.latestCutoff, null);
    });

    it('sorts output draws newest-first even if input draws are in chronological order', () => {
        const chronologicalDraws = [
            { drawNumber: '100', date: 'January 1, 2023', crs: '480', class: 'Canadian Experience Class', subclass: '', drawSize: '1,000' },
            { drawNumber: '200', date: 'June 1, 2024', crs: '520', class: 'Canadian Experience Class', subclass: '', drawSize: '2,000' },
        ];
        const result = calculateDrawMatch(chronologicalDraws, 500, 'CEC', 0);
        assert.equal(result.draws[0].drawNumber, '200');
        assert.equal(result.draws[0].date, 'June 1, 2024');
        assert.equal(result.latestCutoff, 520);
    });
});
