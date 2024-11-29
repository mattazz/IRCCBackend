import irccDrawScraper from './irccDrawScraper.js';

/**
 * TODO
 * [ ] Dump the output into a file and check the data compared to the actual CRS scores if the 
 * rolling average is actually working
 * 
 * [ ] Check if the rolling average is working properly
 */

/**
 * This module is responsible for analyzing the data from the IRCC draw
 * 
 * @param {*} data -> parsedDrawArray{date, drawNumber, crs, class, drawSize}
 */
export const analyzeCRSRollingAverage = (data, rolling_length = 4) => {

    const crsData = data
        .map(draw => ({
            date: draw.date,
            crs: Number(draw.crs), // Convert CRS to a number
        }))
        .filter(draw => !isNaN(draw.crs)); // Filter out invalid CRS values


    // Check if there is sufficient data to calculate a rolling average
    if (crsData.length < rolling_length) {
        console.error("Not enough data points for rolling average.");
        return [];
    }

    // Calculate rolling averages
    const rollingAverage = [];
    for (let i = 0; i <= crsData.length - rolling_length; i++) {
        const batch = crsData.slice(i, i + rolling_length); // Get a batch of draws
        const average =
            batch.reduce((acc, curr) => acc + curr.crs, 0) / rolling_length; // Calculate average
        rollingAverage.push({
            date: batch[0].date, // Use the date of the first draw in the batch
            average: parseFloat(average.toFixed(2)), // Round to 2 decimal places
        });
    }

    // console.log(`Rolling Average: ${JSON.stringify(rollingAverage, null, 2)}`);
    // console.log(`CRS Data: ${JSON.stringify(crsData, null, 2)}`);

    return rollingAverage;

}

export default {analyzeCRSRollingAverage};