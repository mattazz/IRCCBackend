const express = require('express');
const bodyParser = require('body-parser')
const axios = require('axios')
const TelegramBot = require('node-telegram-bot-api')

const rssParser = require('./src/utils/rssParser')
const logger = require('./src/middleware/logger')
const irccDrawScraper = require('./src/utils/irccDrawScraper')
const chartGenerator = require('./src/utils/chartGenerator')
const irccDrawAnalyzer = require('./src/utils/irccDrawAnalyzer')

require('dotenv').config();

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
const devMode = 'false'

// TG Bot
const token = devMode ? process.env.DEV_TG_TOKEN : process.env.TG_TOKEN;
if (!token) {
    console.error("Telegram Bot Token not provided");
    process.exit(1)
}



const url = devMode ? process.env.DEV_URL : process.env.APP_URL;
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
    { command: '/latest', description: 'Get the latest news' },
    { command: '/month', description: 'Get news for a specific month (ex. /month January)' },
    { command: '/full', description: 'Get the full news feed' },
    { command: '/last_draws', description: 'Get the last 5 IRCC draws' },
    { command: '/draws', description: 'Get the last [number] IRCC draws (ex. /draws 10)' },
    { command: '/filter_draws', description: 'Filter draws by class (ex. /filter_draws CEC)' }
]);

// Log all errors
bot.on('webhook_error', (error) => {
    console.error('Webhook Error:', error);  // Log the full error object
});

bot.on('message', (msg) => {
    logger.logUserInteraction(msg);
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
    - /latest - Get the latest news
    - /month [month] - Get news for a specific month (e.g., /month January)
    - /full - Get the full news feed

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
    const chatId = msg.chat.id;
    const introMessage = `
    🤖🇨🇦 Here are some commands you can use:
    - /help - List down all the possible commands

    News: 
    - /latest - Get the latest news
    - /month [month] - Get news for a specific month (e.g., /month January)
    - /full - Get the full news feed

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
    logger.logUserInteraction(msg);
    await bot.sendMessage(chatId, "⁉ Please enter a valid month (e.g., /month January)");
});

bot.onText(/\/month (.+)/, async (msg, match) => {
    const chatId = msg.chat.id;
    const input = match[1]; //captured regex response
    logger.logUserInteraction(msg);

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
            await bot.sendMessage(chatId, "🇨🇦 Here are the news for the month of " + input_month + " " + new Date().getFullYear()+ " 🇨🇦");
        }

        // Send Message, iterate and send one message per item
        for (const item of feedMessage) {
            await bot.sendMessage(chatId, item.title + "\n " + rssParser.formatDate(item.pubDate) + "\n" + item.link);
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

bot.onText("/latest", async (msg) => {
    const chatId = msg.chat.id;
    logger.logUserInteraction(msg);
    try {
        // get latest month
        input_month = new Date().toLocaleString('default', { month: 'long' });

        // Fetch RSS Feed
        let feedMessage = await rssParser.fetchIRCCFeed_Monthly(input_month);

        if (feedMessage.length === 0) {
            await bot.sendMessage(chatId, "No news found for the month of " + input_month + " " + new Date().getFullYear());
            return
        } else {
        }

        // Send Message, iterate and send one message per item
        for (const item of feedMessage) {
            await bot.sendMessage(chatId, item.title + "\n " + rssParser.formatDate(item.pubDate) + "\n" + item.link);
        }
    } catch (error) {
        await bot.sendMessage(chatId, `⁉ Error fetching feed for the month of ${input_month} ${new Date().getFullYear()}`);
        console.error("Error onText: " + error.stack);
    }
});


bot.onText(/\/full (.+)/, async (msg) => {
    const chatId = msg.chat.id;
    logger.logUserInteraction(msg);
    // Fetch RSS Feed
    try {
        let feedResult = await rssParser.fetchFullIRCCFeed();
        let feedMessage = feedResult.items
        // Send Message, iterate and send one message per item
        for (const item of feedMessage) {
            await bot.sendMessage(chatId, item.title + "\n " + rssParser.formatDate(item.pubDate) + "\n" + item.link);
        }
    } catch (error) {
        await bot.sendMessage(chatId, "⁉ Error fetching feed, please try again. ");
        console.error("Error fetching feed: " + error.stack);
    }
})

bot.onText("/last_draws", async (msg) => {
    const chatId = msg.chat.id;
    logger.logUserInteraction(msg);

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
    logger.logUserInteraction(msg);

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

bot.onText(/\/filter_draws (.+)/, async (msg, match) => {
    const chatId = msg.chat.id;
    const filterCode = match[1]; //captured regex response
    logger.logUserInteraction(msg);

    try {
        let [drawData, subclassDrawData] = await irccDrawScraper.filterDraws(filterCode, 300);

        let toMessageDrawData = drawData.length > 10 ? drawData.slice(0, 10) : drawData

        if (subclassDrawData.length != 0) {
            toMessageDrawData = subclassDrawData.length > 10 ? subclassDrawData.slice(0, 10) : subclassDrawData;
        }
        else {
            toMessageDrawData = drawData.length > 10 ? drawData.slice(0, 10) : drawData
        }

        await bot.sendMessage(chatId, `🇨🇦Showing the last 10 draws for ${filterCode}🇨🇦`);

        for (const draw of toMessageDrawData) {
            await bot.sendMessage(chatId, `Draw Number: ${draw.drawNumber}\nDate: ${draw.date}\n👉CRS: ${draw.crs}\n👉Class: ${draw.class}\n👉Sub-class: ${draw.subclass}\n👉Draw Size: ${draw.drawSize}`);
        }

        // Analyze draws 
        let analyzedData = irccDrawAnalyzer.analyzeCRSRollingAverage(drawData);

        console.log(analyzedData);
        


        if (analyzedData.length < 2) {
            await bot.sendMessage(chatId, "⁉ Not enough specific subclass data to analyze the rolling average CRS.");
            return
        } else if (analyzedData.length == 0) {
            await bot.sendMessage(chatId, "⁉ There is no subclass data to analyze the rolling average CRS.");
            return 
        }

        let img_buffer = await chartGenerator.createChartForRolling(chatId, token, analyzedData);

        // Send message and photo
        bot.sendMessage(chatId, `📊 Hey there! I analyzed the last ${drawData.length - 1} draws from ${drawData[drawData.length - 1].date} to ${drawData[0].date}. Here's the rolling average CRS for the last ${drawData.length} draws.`);
        bot.sendPhoto(chatId, img_buffer);
    } catch (error) {
        await bot.sendMessage(chatId, "⁉ Error fetching draw data, please try again.");
        console.error("bot.onText /filter_draws [CODE] - Error fetching draw data: " + error.stack);
    }
})