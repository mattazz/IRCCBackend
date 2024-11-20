const express = require('express');
const bodyParser = require('body-parser')
const axios = require('axios')
const TelegramBot = require('node-telegram-bot-api')

const rssParser = require('./src/utils/rssParser')
const logger = require('./src/middleware/logger')

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

// TG Bot
const token = process.env.TG_TOKEN || '';
if (!token) {
    console.error("Telegram Bot Token not provided");
    process.exit(1)
}

const url = process.env.APP_URL || 'https://afternoon-crag-31332-056085fc3d15.herokuapp.com/';
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
    { command: '/month', description: 'Get news for a specific month (e.g., /month January)' },
    { command: '/full', description: 'Get the full news feed' }
]);

// Log all errors
bot.on('webhook_error', (error) => {
    console.error('Webhook Error:', error);  // Log the full error object
});

bot.on('message', (msg) =>{
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
    - /latest - Get the latest news
    - /month [month] - Get news for a specific month (e.g., /month January)
    - /full - Get the full news feed`
    bot.sendMessage(chatId, introMessage);
});

bot.onText(/\/help/, (msg) => {
    const chatId = msg.chat.id;
    const introMessage = `
    🤖🇨🇦 Here are some commands you can use:

    - /help - List down all the possible commands
    - /latest - Get the latest news
    - /month [month] - Get news for a specific month (e.g., /month January)
    - /full - Get the full news feed`
    bot.sendMessage(chatId, introMessage);
});


bot.onText("/month", (msg) => {
    const chatId = msg.chat.id;
    bot.sendMessage(chatId, "Please enter a valid month (e.g. /month January)");
})


bot.onText(/\/month (.+)/, async (msg, match) => {
    const chatId = msg.chat.id;
    const input = match[1]; //captured regex response
    logger.logUserInteraction(msg);
    try {
        input_month = rssParser.validateUserMonthInput(input, "string");

        // Fetch RSS Feed
        let feedMessage = await rssParser.fetchIRCCFeed_Monthly(input_month);

        if (feedMessage.length === 0) {
            bot.sendMessage(chatId, "No news found for the month of " + input_month + " " + new Date().getFullYear());
            return
        } else {
            bot.sendMessage(chatId, "Here are the news for the month of " + input_month + " " + new Date().getFullYear());
        }

        // Send Message, iterate and send one message per item
        feedMessage.forEach(item => {
            bot.sendMessage(chatId, item.title + "\n " + rssParser.formatDate(item.pubDate) + "\n" + item.link);
        });
    } catch (error) {
        bot.sendMessage(chatId, "Please enter a valid month (e.g. /month January)");
        console.error("Error onText: " + error.stack);
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
            bot.sendMessage(chatId, "No news found for the month of " + input_month + " " + new Date().getFullYear());
            return
        } else {
            bot.sendMessage(chatId, "Here are the news for the month of " + input_month + " " + new Date().getFullYear());
        }

        // Send Message, iterate and send one message per item
        feedMessage.forEach(item => {
            bot.sendMessage(chatId, item.title + "\n " + rssParser.formatDate(item.pubDate) + "\n" + item.link);
        });
    } catch (error) {
        bot.sendMessage(chatId, `Error fetching feed for the month of ${input_month} ${new Date().getFullYear()}`);
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
        feedMessage.forEach(item => {
            bot.sendMessage(chatId, item.title + "\n " + rssParser.formatDate(item.pubDate) + "\n" + item.link);
        })


    } catch (error) {
        bot.sendMessage(chatId, "Error fetching feed: " + error.message);
        console.error("Error fetching feed: " + error.message);
    }
})