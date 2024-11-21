const irccDrawScraper = require('./irccDrawScraper');

/**
 * This module is responsible for analyzing the data from the IRCC draw
 * 
 * @param {*} data -> parsedDrawArray{date, drawNumber, crs, class, drawSize}
 */
const analyzeCRSRollingAverage = (data, rolling_length = 2) => {
    console.log("Data from Analyzer: ", data);

    const crsData = data.map(draw => {
        const crsScore = Number(draw.crs); // Convert CRS to a number
        return {
            date: draw.date,
            crs: crsScore
        };
    }).filter(draw => !isNaN(draw.crs)); // Filter out invalid CRS values

    // console.log("irccDrawAnalyze.js: Filtered Crs Data from Analyzer: ", crsData);
    

      // Check if there is sufficient data to calculate a rolling average
      if (crsData.length < rolling_length) {
        console.error("Not enough data points for rolling average.");
        return [];
    }

    

    // analyze rolling average of the CRS scores per 5 draws
    const rollingAverage = [];
    for (let i = 0; i <= crsData.length - rolling_length; i++) {
        const batch = crsData.slice(i, i + rolling_length);
        const average = batch.reduce((acc, curr) => acc + curr.crs, 0) / batch.length;
        rollingAverage.push({
            date: batch[batch.length - 1].date, // Use the date of the last draw in the batch
            average: parseFloat(average.toFixed(2)) // Round to 2 decimal places
        });
    }
    return rollingAverage;

}

module.exports={
    analyzeCRSRollingAverage
}