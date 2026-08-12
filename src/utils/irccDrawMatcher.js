import irccDrawScraper from './irccDrawScraper.js';
import utils from './utils.js';

/**
 * Calculates CRS score match analytics against Express Entry draw history.
 *
 * @param {Array} draws Array of parsed draw objects from irccDrawScraper / dataCache.
 * @param {number} userScore Candidate's CRS score (1 - 1200).
 * @param {string} [classCode=''] Optional class filter code (e.g. 'CEC', 'STEM').
 * @param {number} [timeframeMonths=12] Timeframe window in months (0 for all-time).
 * @returns {Object} Analytical match result object.
 */
export const calculateDrawMatch = (draws, userScore, classCode = '', timeframeMonths = 12) => {
    const score = Number(userScore);
    if (isNaN(score) || score < 1 || score > 1200) {
        throw new Error('Invalid user score - must be a number between 1 and 1200');
    }

    let filteredDraws = [...(draws || [])];

    // Filter by class code if provided
    const upperClassCode = (classCode || '').toUpperCase();
    let className = 'All Classes';
    if (upperClassCode && utils.classFilterMap[upperClassCode]) {
        className = utils.classFilterMap[upperClassCode];
        filteredDraws = filteredDraws.map(d => ({
            ...d,
            subclass: d.subclass || '',
        }));
        const [primary, secondary] = irccDrawScraper.filterParsedDraws(filteredDraws, upperClassCode);
        filteredDraws = primary.length > 0 ? primary : secondary;
    }

    // Filter by timeframe if specified (> 0)
    if (timeframeMonths > 0) {
        const cutoffDate = new Date();
        cutoffDate.setMonth(cutoffDate.getMonth() - timeframeMonths);
        filteredDraws = filteredDraws.filter(draw => {
            const d = new Date(draw.date);
            return !isNaN(d.getTime()) && d >= cutoffDate;
        });
    }

    // Process valid numeric CRS draws
    const validDraws = filteredDraws
        .map(draw => ({
            ...draw,
            crsNum: Number(draw.crs),
        }))
        .filter(draw => !isNaN(draw.crsNum))
        .sort((a, b) => new Date(b.date) - new Date(a.date));

    const totalDraws = validDraws.length;

    if (totalDraws === 0) {
        return {
            userScore: score,
            classCode: upperClassCode || 'ALL',
            className,
            timeframeMonths,
            totalDraws: 0,
            qualifyingDrawsCount: 0,
            matchRatePercentage: 0,
            chanceLevel: 'Unlikely',
            latestCutoff: null,
            averageCutoff: null,
            minCutoff: null,
            maxCutoff: null,
            scoreGapLatest: null,
            scoreGapAverage: null,
            percentileRank: 0,
            recommendations: {
                pointsToLatest: 0,
                pointsToAverage: 0,
                pointsTo75thPercentile: 0,
            },
            draws: [],
        };
    }

    // Identify qualifying draws (where userScore >= draw.crs)
    const annotatedDraws = validDraws.map(draw => ({
        drawNumber: draw.drawNumber,
        date: draw.date,
        crs: draw.crs,
        class: draw.class,
        subclass: draw.subclass,
        drawSize: draw.drawSize,
        url: draw.url || '',
        tieBreakingRule: draw.tieBreakingRule || '',
        drawDateTime: draw.drawDateTime || '',
        poolTotal: draw.poolTotal || '',
        poolDistributionAsOn: draw.poolDistributionAsOn || '',
        qualified: score >= draw.crsNum,
        gap: score - draw.crsNum,
    }));

    const qualifyingDrawsCount = annotatedDraws.filter(d => d.qualified).length;
    const matchRatePercentage = Math.round((qualifyingDrawsCount / totalDraws) * 100);

    let chanceLevel = 'Unlikely';
    if (matchRatePercentage >= 70) {
        chanceLevel = 'High';
    } else if (matchRatePercentage >= 40) {
        chanceLevel = 'Moderate';
    } else if (matchRatePercentage >= 10) {
        chanceLevel = 'Low';
    }

    const crsValues = validDraws.map(d => d.crsNum);
    const latestCutoff = crsValues[0]; // cache is most-recent-first
    const minCutoff = Math.min(...crsValues);
    const maxCutoff = Math.max(...crsValues);
    const sumCutoffs = crsValues.reduce((acc, curr) => acc + curr, 0);
    const averageCutoff = Math.round(sumCutoffs / totalDraws);

    const scoreGapLatest = score - latestCutoff;
    const scoreGapAverage = score - averageCutoff;

    // Percentile rank: percentage of draws where user score >= draw CRS
    const percentileRank = Math.round((crsValues.filter(c => score >= c).length / totalDraws) * 100);

    // Sorted cutoffs ascending for percentile analysis
    const sortedCutoffs = [...crsValues].sort((a, b) => a - b);
    const p75Index = Math.min(sortedCutoffs.length - 1, Math.floor(sortedCutoffs.length * 0.75));
    const target75thCutoff = sortedCutoffs[p75Index];

    const recommendations = {
        pointsToLatest: Math.max(0, latestCutoff - score),
        pointsToAverage: Math.max(0, averageCutoff - score),
        pointsTo75thPercentile: Math.max(0, target75thCutoff - score),
    };

    return {
        userScore: score,
        classCode: upperClassCode || 'ALL',
        className,
        timeframeMonths,
        totalDraws,
        qualifyingDrawsCount,
        matchRatePercentage,
        chanceLevel,
        latestCutoff,
        averageCutoff,
        minCutoff,
        maxCutoff,
        scoreGapLatest,
        scoreGapAverage,
        percentileRank,
        recommendations,
        draws: annotatedDraws,
    };
};

export default { calculateDrawMatch };
