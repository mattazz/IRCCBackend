import express from 'express';
import bodyParser from 'body-parser';
import axios from 'axios';
import TelegramBot from 'node-telegram-bot-api';

import rssParser from './src/utils/rssParser.js';
import logger from './src/middleware/logger.js';
import irccDrawScraper from './src/utils/irccDrawScraper.js';
import chartGenerator from './src/utils/chartGenerator.js';
import irccDrawAnalyzer from './src/utils/irccDrawAnalyzer.js';
import utils from './src/utils/utils.js';
import speechNewsParser from './src/utils/speechNewsParser.js';

import dotenv from 'dotenv';
dotenv.config();

const app = express()
app.use(bodyParser.json())

// Connect to DB - eventually

// Port
const port = process.env.PORT || 3000

// Routes

app.get('/', (req, res) => {
    res.send('Hello, this is the IRCC News Bot server.');
});

app.listen(port, () => {
    console.log(`App listening on port ${port}`);

})

/** Changes URL and Token to be used */
const devMode = process.env.DEV_MODE === 'true'
console.log("Setting Dev Mode:" + devMode);


// TG Bot
const token = devMode ? process.env.DEV_TG_TOKEN : process.env.TG_TOKEN;
console.log("Setting TG Bot token:" + token);

if (!token) {
    console.error("Telegram Bot Token not provided");
    process.exit(1)
}



const url = devMode ? process.env.DEV_URL : process.env.APP_URL;
console.log("Setting URL:" + url);


const webhookPath = process.env.WEBHOOK_PATH || '/webhook';
const bot = new TelegramBot(token, { webHook: true })


bot.setWebHook(`${url}${webhookPath}`);

app.post('/webhook', (req, res) => {
    bot.processUpdate(req.body);
    res.sendStatus(200);
})
// Set up command menu
bot.setMyCommands([
    { command: '/help', description: 'Get the bot commands' },
    { command: '/latest_news', description: 'Get the latest news' },
    { command: '/search_news', description: 'Search for news by keyword (ex. /search_news Express Entry)' },
    { command: '/month', description: 'Get news for a specific month (ex. /month January)' },
    { command: '/latest_speech', description: 'Get the last 10 official speeches' },
    { command: '/last_draws', description: 'Get the last 5 IRCC draws' },
    { command: '/draws', description: 'Get the last [number] IRCC draws (ex. /draws 10)' },
    { command: '/filter_draws', description: 'Filter draws by class (ex. /filter_draws CEC)' }
]);

// Log all errors
bot.on('webhook_error', (error) => {
    console.error('Webhook Error:', error);  // Log the full error object
});

bot.on('message', (msg) => {

    logger.logUserInteraction(bot, msg);
})

app.post(webhookPath, (req, res) => {
    bot.processUpdate(req.body);
    console.log(req.body);

    res.sendStatus(200);
})

bot.onText(/\/start/, (msg) => {
    const chatId = msg.chat.id;
    const introMessage = `
    Welcome to the IRCC News Bot! 🤖🇨🇦

    Stay up-to-date with the latest Immigration, Refugees, and Citizenship Canada (IRCC) news and updates. 

    Here are some commands you can use:
    - /help - List down all the possible commands

    News: 
    - /latest_news - Get the latest news
    - /month [month] - Get news for a specific month (e.g., /month January)
    - /search_news [keyword] - Search for news by keyword (e.g., /search_news Express Entry)
    - /latest_speech - Get the last 10 news regarding official speeches

    Draws:
    - /last_draws - Get the last 5 IRCC draws
    - /draws [number] - Get the last [number] IRCC draws
    - /filter_draws [class] - Filter draws by class and shows the last 10 draws (e.g., /filter_draws CEC)
    
    Filter Draw codes: 
    "CEC" - Canadian Experience Class
    "FSW" - Federal Skilled Worker
    "FST" - Federal Skilled Trades
    "PNP" - Provincial Nominee Program
    "FLP": "French language proficiency",
    "TO": "Trade occupations",
    "HO": "Healthcare occupations",
    "STEM": "STEM occupations",
    "GEN" : "General",
    "TRAN": "Transport occupations",
    "AGRI": "Agriculture and agri-food occupations"
    `

    bot.sendMessage(chatId, introMessage);
});

bot.onText(/\/help/, (msg) => {
    logger.logUserInteraction(bot, msg);
    const logString = logger.parseLogToString(bot, msg);
    logger.sendLogToPrimary(bot, process.env.ADMIN_USER_ID, logString);

    const chatId = msg.chat.id;
    const introMessage = `
    🤖🇨🇦 Here are some commands you can use:
    - /help - List down all the possible commands

    News: 
    - /latest_news - Get the latest news
    - /month [month] - Get news for a specific month (e.g., /month January)
    - /search_news [keyword] - Search for news by keyword (e.g., /search_news Express Entry)
    - /latest_speech - Get the last 10 news regarding official speeches

    Draws:
    - /last_draws - Get the last 5 IRCC draws
    - /draws [number] - Get the last [number] IRCC draws
    - /filter_draws [class] - Filter draws by class and shows the last 10 draws (e.g., /filter_draws CEC)
    
    Filter Draw codes: 
    "CEC" - Canadian Experience Class
    "FSW" - Federal Skilled Worker
    "FST" - Federal Skilled Trades
    "PNP" - Provincial Nominee Program
    "FLP": "French language proficiency",
    "TO": "Trade occupations",
    "HO": "Healthcare occupations",
    "STEM": "STEM occupations",
    "GEN" : "General",
    "TRAN": "Transport occupations",
    "AGRI": "Agriculture and agri-food occupations"`

    bot.sendMessage(chatId, introMessage);

});

// Handle /month with no parameters
bot.onText(/\/month$/, async (msg) => {
    const chatId = msg.chat.id;
    logger.logUserInteraction(bot, msg);
    const logString = logger.parseLogToString(bot, msg);
    logger.sendLogToPrimary(bot, process.env.ADMIN_USER_ID, logString);

    await bot.sendMessage(chatId, "⁉ Please enter a valid month (e.g., /month January)");

});

bot.onText(/\/month (.+)/, async (msg, match) => {
    const chatId = msg.chat.id;
    const input = match[1]; //captured regex response

    logger.logUserInteraction(bot, msg);
    const logString = logger.parseLogToString(bot, msg);
    logger.sendLogToPrimary(bot, process.env.ADMIN_USER_ID, logString);


    if (!input) {
        await bot.sendMessage(chatId, "⁉ Please enter a valid month (e.g. /month January)");
        return
    }

    try {
        const input_month = rssParser.validateUserMonthInput(input, "string");

        // Fetch RSS Feed
        let feedMessage = await rssParser.fetchIRCCFeed_Monthly(input_month);

        if (feedMessage.length === 0) {
            await bot.sendMessage(chatId, "⁉ No news found for the month of " + input_month + " " + new Date().getFullYear());
            return
        } else {
            await bot.sendMessage(chatId, "🇨🇦 Here are the news for the month of " + input_month + " " + new Date().getFullYear() + " 🇨🇦");
        }

        // Send Message, iterate and send one message per item
        for (const item of feedMessage) {
            await bot.sendMessage(chatId, item.title + "\n " + utils.formatDate(item.pubDate) + "\n" + item.link);
        }
    } catch (error) {
        if (error.message === "Invalid Month") {
            await bot.sendMessage(chatId, "⁉ Please enter a valid month (e.g. /month January)");
            return
        } else {
            console.error("Error fetching feed: " + error.stack);
            await bot.sendMessage(chatId, "⁉ Error fetching feed, please try again. ");
        }

    }
});

bot.onText("/latest_news", async (msg) => {
    const chatId = msg.chat.id;

    logger.logUserInteraction(bot, msg);
    const logString = logger.parseLogToString(bot, msg);
    logger.sendLogToPrimary(bot, process.env.ADMIN_USER_ID, logString);

    try {
        // get latest month
        let input_month = new Date().toLocaleString('default', { month: 'long' });

        // Fetch RSS Feed
        let feedMessage = await rssParser.fetchIRCCFeed_Monthly(input_month);

        if (feedMessage.length === 0) {
            await bot.sendMessage(chatId, "No news found for the month of " + input_month + " " + new Date().getFullYear());
            return
        } else {
        }

        // Send Message, iterate and send one message per item
        for (const item of feedMessage) {
            await bot.sendMessage(chatId, item.title + "\n " + utils.formatDate(item.pubDate) + "\n" + item.link);
        }
    } catch (error) {
        await bot.sendMessage(chatId, `⁉ Error fetching feed for the month of ${input_month} ${new Date().getFullYear()}`);
        console.error("Error onText: " + error.stack);
    }
});

bot.onText(/\/search_news (.+)/, async (msg, match) => {
    const chatId = msg.chat.id;
    const keyword = match[1]; //captured regex response    

    logger.logUserInteraction(bot, msg);
    const logString = logger.parseLogToString(bot, msg);
    logger.sendLogToPrimary(bot, process.env.ADMIN_USER_ID, logString);

    try {
        let feedMessage = await rssParser.keywordSearchIRCCFeed(keyword);

        if (feedMessage.length === 0) {
            await bot.sendMessage(chatId, "⁉ No news found for the keyword " + keyword);
            return
        } else {
            await bot.sendMessage(chatId, "🇨🇦 Here are the news for the keyword: " + keyword + " 🇨🇦");
        }

        // Send Message, iterate and send one message per item
        for (const item of feedMessage) {
            await bot.sendMessage(chatId, item.title + "\n " + utils.formatDate(item.pubDate) + "\n" + item.link);
        }
    } catch (error) {
        await bot.sendMessage(chatId, "⁉ Error fetching feed, please try again. ");
        console.error("Error fetching feed: " + error.stack)

    }

})


bot.onText("/full", async (msg) => {
    const chatId = msg.chat.id;

    logger.logUserInteraction(bot, msg);
    const logString = logger.parseLogToString(bot, msg);
    logger.sendLogToPrimary(bot, process.env.ADMIN_USER_ID, logString);

    // Fetch RSS Feed
    try {
        let feedResult = await rssParser.fetchFullIRCCFeed();
        let feedMessage = feedResult.items
        // Send Message, iterate and send one message per item
        for (const item of feedMessage) {
            await bot.sendMessage(chatId, item.title + "\n " + utils.formatDate(item.pubDate) + "\n" + item.link);
        }
    } catch (error) {
        await bot.sendMessage(chatId, "⁉ Error fetching feed, please try again. ");
        console.error("Error fetching feed: " + error.stack);
    }
})

bot.onText("/latest_speech", async(msg) =>{
    const chatId = msg.chat.id;
    logger.logUserInteraction(bot, msg);
    const logString = logger.parseLogToString(bot, msg);
    logger.sendLogToPrimary(bot, process.env.ADMIN_USER_ID, logString);

    bot.sendMessage(chatId, "🇨🇦 Fetching the last 10 speech news, this might take a few seconds... 🙏 🇨🇦");

    try {
        let speechData = await speechNewsParser.getStoredSpeechArticles();

        speechData = speechData.slice(0, 10);
        
        if (speechData.length === 0) {
            await bot.sendMessage(chatId, "⁉ No speech news found");
            return
        } else {
            await bot.sendMessage(chatId, "🇨🇦 Here are the latest speech news 🇨🇦");
        }

        // Send Message, iterate and send one message per item
        for (const item of speechData) {
            await bot.sendMessage(chatId, item.title + "\n " + utils.formatDate(item.date) + "\n" + item.url);
        }
    } catch(error){
        await bot.sendMessage(chatId, "⁉ Error fetching speech news, please try again. ");
        console.error("Error fetching speech news: " + error.stack);
    }


})

bot.onText("/last_draws", async (msg) => {
    const chatId = msg.chat.id;

    logger.logUserInteraction(bot, msg);
    const logString = logger.parseLogToString(bot, msg);
    logger.sendLogToPrimary(bot, process.env.ADMIN_USER_ID, logString);

    try {
        let drawData = await irccDrawScraper.parseDraws(5);
        for (const draw of drawData) {
            await bot.sendMessage(chatId, `Draw Number: ${draw.drawNumber}\nDate: ${draw.date}\n👉CRS: ${draw.crs}\n👉Class: ${draw.class}\n👉Sub-class: ${draw.subclass}\n👉Draw Size: ${draw.drawSize}`);
        }
    } catch (error) {
        await bot.sendMessage(chatId, "⁉ Error fetching draw data");
        console.error("bot.onText /last_draws - Error fetching draw data: " + error.stack);
    }
})

bot.onText(/\/draws (.+)/, async (msg, match) => {
    const chatId = msg.chat.id;
    const input = match[1]; //captured regex response

    logger.logUserInteraction(bot, msg);
    const logString = logger.parseLogToString(bot, msg);
    logger.sendLogToPrimary(bot, process.env.ADMIN_USER_ID, logString);

    await bot.sendMessage(chatId, "🇨🇦 Fetching the last " + input + " draws, this might take a few seconds... 🙏 🇨🇦");

    try {
        let drawData = await irccDrawScraper.parseDraws(input);
        for (const draw of drawData) {
            await bot.sendMessage(chatId, `Draw Number: ${draw.drawNumber}\nDate: ${draw.date}\n👉CRS: ${draw.crs}\n👉Class: ${draw.class}\n👉Sub-class: ${draw.subclass}\n👉Draw Size: ${draw.drawSize}`);

        }
    } catch (error) {
        await bot.sendMessage(chatId, "⁉ Error fetching draw data, please try again.");
        console.error("bot.onText /draws [num] - Error fetching draw data: " + error.message);
    }
})

const classFilterMap = {
    "CEC": "Canadian Experience Class",
    "FSW": "Federal Skilled Worker",
    "FST": "Federal Skilled Trades",
    "PNP": "Provincial Nominee Program",
    "FLP": "French language proficiency",
    "TO": "Trade occupations",
    "HO": "Healthcare occupations",
    "STEM": "STEM occupations",
    "GEN" : "General",
    "TRAN": "Transport occupations",
    "AGRI": "Agriculture and agri-food occupations",
}

bot.onText(/\/filter_draws (.+)/, async (msg, match) => {
    const chatId = msg.chat.id;
    const filterCode = match[1]; //captured regex response

    if(!classFilterMap[filterCode.toUpperCase()]){
        await bot.sendMessage(chatId, "⁉ Invalid filter code. Please use a valid code (see /help for the list of valid codes).");
    }
    

    logger.logUserInteraction(bot, msg);
    const logString = logger.parseLogToString(bot, msg);
    logger.sendLogToPrimary(bot, process.env.ADMIN_USER_ID, logString);

    try {
        let [drawData, subclassDrawData] = await irccDrawScraper.filterDraws(filterCode, 300);



        let toMessageDrawData = drawData.length > 10 ? drawData.slice(0, 10) : drawData

        if (subclassDrawData.length != 0) {
            toMessageDrawData = subclassDrawData.length > 10 ? subclassDrawData.slice(0, 10) : subclassDrawData;
        }
        else {
            toMessageDrawData = drawData.length > 10 ? drawData.slice(0, 10) : drawData
        }

        await bot.sendMessage(chatId, `🇨🇦Showing the last 10 draws for ${classFilterMap[filterCode.toUpperCase()]}🇨🇦`);

        for (const draw of toMessageDrawData) {
            await bot.sendMessage(chatId, `Draw Number: ${draw.drawNumber}\nDate: ${draw.date}\n👉CRS: ${draw.crs}\n👉Class: ${draw.class}\n👉Sub-class: ${draw.subclass}\n👉Draw Size: ${draw.drawSize}`);
        }        

        // Analyze draws 
        let analyzedData = irccDrawAnalyzer.analyzeCRSRollingAverage(drawData);

        // console.log(analyzedData);



        if (analyzedData.length < 2) {
            await bot.sendMessage(chatId, "⁉ Not enough specific draw class data to analyze the rolling average CRS.");
            return
        } else if (analyzedData.length == 0) {
            await bot.sendMessage(chatId, "⁉ There is no subclass data to analyze the rolling average CRS.");
            return
        }

        let img_buffer = await chartGenerator.createChartForRolling(chatId, token, drawData, analyzedData, `Rolling Average CRS for ${filterCode}`);

        // Send message and photo
        bot.sendMessage(chatId, `📊 Hey there! I analyzed the last ${drawData.length} draws from ${drawData[drawData.length - 1].date} to ${drawData[0].date}. Here's the rolling average CRS for the last ${drawData.length} draws.`);
        bot.sendPhoto(chatId, img_buffer);
    } catch (error) {
        await bot.sendMessage(chatId, "⁉ Error fetching draw data, please try again.");
        console.error("bot.onText /filter_draws [CODE] - Error fetching draw data: " + error.stack);
    }
})