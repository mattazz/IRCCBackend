const speechNewsParser = require('./speechNewsParser')

const workerDBUpdater = async () => {
    console.log(`[workerDBUpdater.js] => Worker started.`);

    await speechNewsParser.scheduledScrapeAndPush();

    console.log(`[workerDBUpdater.js] => Worker finished.`);
}

workerDBUpdater();