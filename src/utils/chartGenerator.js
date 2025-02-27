import {analyzeCRSRollingAverage} from './irccDrawAnalyzer.js';
import ChartJsImage from 'chartjs-to-image'; // Import chartjs-to-image
// Get the data


/** Utility function to create a chart for the rolling average CRS.
 * 
 * @param {*} chat_id  -> Chat ID
 * @param {*} bot_token  -> Telegram bot token
 * @param {*} analyzedData -> Needs analyzedData from irccDrawAnalyzer.analyzeCRSRollingAverage(drawData) 
 * @returns  -> Image buffer
 */
const createChartForRolling = async (chat_id, bot_token,drawData = null, analyzedData = null, chartTitle = "Rolling Average CRS") => {
    if (!analyzedData) {
        analyzedData = analyzeCRSRollingAverage(drawData);
    }

    // Sort the analyzedData by date
    analyzedData.sort((a, b) => new Date(a.date) - new Date(b.date));
    drawData.sort((a, b) => new Date(a.date) - new Date(b.date));


    // Create the chart
    const chart = new ChartJsImage();

    chart.setConfig({
        type: 'line',
        data: {
            labels: drawData.map(data => data.date),
            datasets: [{
                label: chartTitle,
                data: analyzedData.map(data => data.average),
                borderColor: 'rgb(252, 48, 3)',
                backgroundColor: 'rgba(252, 48, 3, 0.2)',
                fill: true,
                tension: 0.1
            },
            {
                label: 'Actual CRS Scores',
                borderColor: 'rgb(75, 192, 192)',
                data: drawData ? drawData.map(data => data.crs) : [],
                backgroundColor: 'rgba(75, 192, 192, 0.2)',
                fill: false,
                tension: 0.1
            }
        ]
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

export default {createChartForRolling};