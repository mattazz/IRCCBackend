import speechNewsParser from './speechNewsParser.js';

const workerDBUpdater = async () => {
    console.log(`[workerDBUpdater.js] => Worker started.`);
    console.log(`[workerDBUpdater.js] => Running speechNewsParser.scheduledScrapeandPush() and push...`);
    await speechNewsParser.scheduledScrapeAndPush();

    console.log(`[workerDBUpdater.js] => Worker finished.`);
}

workerDBUpdater();