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

app.listen(port, () => {
    console.log(`App listening on port ${port}`);

})

// TG Bot
const token = process.env.TG_TOKEN || '';
if (!token) {
    console.error("Telegram Bot Token not provided");
    process.exit(1)
}

const bot = new TelegramBot(token, { polling: true })

// Set up command menu
bot.setMyCommands([
    { command: '/help', description: 'Get the bot commands' },
    { command: '/latest', description: 'Get the latest news' },
    { command: '/month', description: 'Get news for a specific month (e.g., /month January)' },
    { command: '/full', description: 'Get the full news feed' }
]);

// Log all errors
bot.on('polling_error', (error) => {
    console.error('Polling Error:', error);  // Log the full error object
});

bot.on('message', (msg) =>{
    logger.logUserInteraction(msg);
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

    console.log(`User${chatId} action - /month : ${input}`);

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
    console.log(`User${chatId} action - /latest`);

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

    console.log(`User${chatId} action - /full`);
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