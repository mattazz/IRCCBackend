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
 * @returns 
 */
const createChartForRolling = async (chat_id, bot_token, analyzedData = null) => {
    if (!analyzedData) {
        analyzedData = irccDrawAnalyzer.analyzeCRSRollingAverage(drawData);
    }

    // Create the chart
    const chart = new ChartJsImage();

    chart.setConfig({
        type: 'line',
        data: {
            labels: analyzedData.map(data => data.date),
            datasets: [{
                label: 'Rolling Average CRS',
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

    // generate image

    try {
        // Get the chart as a binary buffer (image in memory)
        const imageBuffer = await chart.toBinary();

        return imageBuffer

        // Prepare form data for sending the image via Telegram bot
        const form = new FormData();
        form.append('photo', imageBuffer, { filename: 'analyzed.png', contentType: 'image/png' });
        form.append('chat_id', chat_id);

        // Debug form data
        // console.log("Form Data:", form);


        // Send the image buffer directly to Telegram via API
        const response = await fetch(`https://api.telegram.org/bot${bot_token}/sendPhoto`, {
            method: 'POST',
            body: form,
            headers: form.getHeaders(),
        });

        if (!response.ok) {
            const responseText = await response.text();
            console.error("Error response from Telegram API:", responseText);
            throw new Error(`Telegram API responded with status ${response.status}`);
        }


        const result = await response.json();
        console.log("Image sent successfully:", result);

    } catch (error) {
        console.error("Error generating or sending image:", error);
    }

}

module.exports = {
    createChartForRolling
}