const express = require('express');
const bodyParser = require('body-parser')
const axios = require('axios')
const TelegramBot = require('node-telegram-bot-api')

const rssParser = require('./utils/rssParser')

require('dotenv').config();

const app = express()
app.use(bodyParser.json())

// Connect to DB - eventually

// Port
const port = process.env.PORT || 3000

// Routes
app.get('/', (req, res) => {
    res.send('Hello World!')
})

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

bot.on('polling_error', (error) => {
    console.error('Polling Error:', error);  // Log the full error object
});

bot.onText(/\/month (.+)/, async (msg, match) => {
    const chatId = msg.chat.id;
    const input = match[1]; //captured regex response

    console.log(`regex response: ${input}`);
    
    try {
        input_month = rssParser.validateUserMonthInput(input, "string");

        // Fetch RSS Feed
        let feedMessage = await rssParser.fetchIRCCFeed_Monthly(input_month);

        if (feedMessage.length === 0) {
            bot.sendMessage(chatId, "No news found for the month of " + input_month + " " + new Date().getFullYear());
            return
        } else{
            bot.sendMessage(chatId, "Here are the news for the month of " + input_month + " " + new Date().getFullYear());
        }

        // Send Message, iterate and send one message per item
        feedMessage.forEach(item => {
            bot.sendMessage(chatId, item.title + "\n " + rssParser.formatDate(item.pubDate) + "\n" + item.link);
        });
    } catch (error) {
        bot.sendMessage(chatId, "Please enter a valid month (e.g., January, February, March, etc.)");
        console.error("Error onText: " + error.stack);
    }
});

bot.onText("/latest", async (msg) => {
    const chatId = msg.chat.id;
    
    try {
        // get latest month
        input_month = new Date().toLocaleString('default', { month: 'long' });

        // Fetch RSS Feed
        let feedMessage = await rssParser.fetchIRCCFeed_Monthly(input_month);

        if (feedMessage.length === 0) {
            bot.sendMessage(chatId, "No news found for the month of " + input_month + " " + new Date().getFullYear());
            return
        } else{
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


bot.onText(/\/full (.+)/,async (msg) => {
    const chatId = msg.chat.id;
    // Fetch RSS Feed
    try {
        let feedResult = await rssParser.fetchFullIRCCFeed();
        let feedMessage = feedResult.items


        // Send Message, iterate and send one message per item
        feedMessage.forEach(item => {
            bot.sendMessage(chatId, item.title + "\n " + rssParser.formatDate(item.pubDate)  + "\n" + item.link);
        })

        
    } catch (error) {
        bot.sendMessage(chatId, "Error fetching feed: " + error.message);
        console.error("Error fetching feed: " + error.message);
    }
})