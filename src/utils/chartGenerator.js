const irccDrawScraper = require('./irccDrawScraper')
const irccDrawAnalyzer = require('./irccDrawAnalyzer')
const FormData = require('form-data');
const ChartJsImage = require('chartjs-to-image'); // Import chartjs-to-image
// Get the data


/** Utility function to create a chart for the rolling average CRS.
 * 
 * @param {*} chat_id  -> Chat ID
 * @param {*} bot_token  -> Telegram bot token
 * @param {*} analyzedData -> Needs analyzedData from irccDrawAnalyzer.analyzeCRSRollingAverage(drawData) 
 * @returns  -> Image buffer
 */
const createChartForRolling = async (chat_id, bot_token, analyzedData = null, chartTitle = "Rolling Average CRS") => {
    if (!analyzedData) {
        analyzedData = irccDrawAnalyzer.analyzeCRSRollingAverage(drawData);
    }

    // Sort the analyzedData by date
    analyzedData.sort((a, b) => new Date(a.date) - new Date(b.date));


    // Create the chart
    const chart = new ChartJsImage();

    chart.setConfig({
        type: 'line',
        data: {
            labels: analyzedData.map(data => data.date),
            datasets: [{
                label: chartTitle,
                data: analyzedData.map(data => data.average),
                borderColor: 'rgb(75, 192, 192)',
                tension: 0.1
            }]
        },
        options: {
            scales: {
                y: {
                    beginAtZero: true
                }
            }
        }
    })

    chart.setWidth(600);
    chart.setHeight(400);

    /**
     * Generate Image
     */
    try {
        // Get the chart as a binary buffer (image in memory)
        const imageBuffer = await chart.toBinary();

        return imageBuffer
    } catch (error) {
        console.error("Error generating or sending image:", error);
    }

}

module.exports = {
    createChartForRolling
}