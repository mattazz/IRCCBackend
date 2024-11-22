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
const devMode = process.env.DEV_MODE  === 'true'
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
    logger.logUserInteraction(bot, msg);
    const logString = logger.parseLogToString(bot, msg);
    logger.sendLogToPrimary(bot, process.env.ADMIN_USER_ID, logString);   

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

    logger.logUserInteraction(bot, msg);
    const logString = logger.parseLogToString(bot, msg);
    logger.sendLogToPrimary(bot, process.env.ADMIN_USER_ID, logString);

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
            await bot.sendMessage(chatId, item.title + "\n " + rssParser.formatDate(item.pubDate) + "\n" + item.link);
        }
    } catch (error) {
        await bot.sendMessage(chatId, "⁉ Error fetching feed, please try again. ");
        console.error("Error fetching feed: " + error.stack);
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

        await bot.sendMessage(chatId, `🇨🇦Showing the last 10 draws for ${filterCode}🇨🇦`);

        for (const draw of toMessageDrawData) {
            await bot.sendMessage(chatId, `Draw Number: ${draw.drawNumber}\nDate: ${draw.date}\n👉CRS: ${draw.crs}\n👉Class: ${draw.class}\n👉Sub-class: ${draw.subclass}\n👉Draw Size: ${draw.drawSize}`);
        }

        // Analyze draws 
        let analyzedData = irccDrawAnalyzer.analyzeCRSRollingAverage(drawData);

        // console.log(analyzedData);
        


        if (analyzedData.length < 2) {
            await bot.sendMessage(chatId, "⁉ Not enough specific subclass data to analyze the rolling average CRS.");
            return
        } else if (analyzedData.length == 0) {
            await bot.sendMessage(chatId, "⁉ There is no subclass data to analyze the rolling average CRS.");
            return 
        }

        let img_buffer = await chartGenerator.createChartForRolling(chatId, token,drawData, analyzedData, `Rolling Average CRS for ${filterCode}`);

        // Send message and photo
        bot.sendMessage(chatId, `📊 Hey there! I analyzed the last ${drawData.length} draws from ${drawData[drawData.length - 1].date} to ${drawData[0].date}. Here's the rolling average CRS for the last ${drawData.length} draws.`);
        bot.sendPhoto(chatId, img_buffer);
    } catch (error) {
        await bot.sendMessage(chatId, "⁉ Error fetching draw data, please try again.");
        console.error("bot.onText /filter_draws [CODE] - Error fetching draw data: " + error.stack);
    }
})

/** 
 * Creating sub menus
 */

const mainMenu = {
    reply_markup:{
        inline_keyboard: [
            [{ text: "How do I use the FAQ Section?", callback_data: "how" }],
            [{ text: "Learn about Provincial Nomination Programs", callback_data: "pnp" }],
            [{ text: "Immigrating through Express Entry", callback_data: "ee" }],
        ]
    }
};

const justBackToMainMenu = {
    reply_markup:{
        inline_keyboard: [
            [{ text: "Back to Main Menu", callback_data: "main_menu" }],
        ]
    }
}

const backToPNPMenu = {
    reply_markup:{
        inline_keyboard: [
            [{ text: "Back to PNP Menu", callback_data: "pnp" }],
        ]
    }
}

const backToEEMenu = {
    reply_markup:{
        inline_keyboard: [
            [{ text: "Back to Express Entry Menu", callback_data: "ee" }],
        ]
    }
}

bot.onText(/\/faq/, (msg) => {
    logger.logUserInteraction(bot, msg);
    const chatId = msg.chat.id;

    bot.sendMessage(chatId, "🤖🇨🇦 Welcome to the IRCC News Bot FAQ! 🇨🇦🤖", mainMenu);
})

// Handle callback queries
bot.on('callback_query', async (query) =>{
    const chatId = query.message.chat.id;

    /**
     * How do I use the FAQ Section?
     */
    if (query.data === "how"){
        const subMenu = {
            reply_markup:{
                inline_keyboard: [
                    [{ text: "Back to Main Menu", callback_data: "main_menu" }],
                ]
            }
        };    
        bot.sendMessage(chatId, "The FAQ Section is filled with resources regarding...", subMenu);
    } 
    /**
     * Immigrating through Express Entry
     */

    else if(query.data === "ee") {
        const subMenu = {
            reply_markup:{
                inline_keyboard:[
                    [{ text: "How does Express Entry work?", callback_data: "ee_how" }],
                    [{ text: "What are the requirements?", callback_data: "ee_req" }],
                    [{ text: "How to improve my CRS score?", callback_data: "ee_crs" }],
                    [{ text: "Back to Main Menu", callback_data: "main_menu" }],
                ]
            }
        }
        await bot.sendMessage(chatId, "Express Entry is...", subMenu);
    }
    else if (query.data === "ee_how"){
        await bot.sendMessage(chatId, `
            <b>There are 3 immigration programs managed through Express Entry</b>:
            1. Federal Skilled Worker Program
            2. Federal Skilled Trades Program
            3. Canadian Experience Class
            `, {parse_mode: "HTML"});
        await bot.sendMessage(chatId, "To know more, visit the official IRCC site here: https://www.canada.ca/en/immigration-refugees-citizenship/services/immigrate-canada/express-entry/works.html", backToEEMenu);
    }

    /**
     * Learn about Provincial Nomination Programs
     */
    else if (query.data === "pnp"){
        const subMenu = {
            reply_markup:{
                inline_keyboard: [
                    [{ text: "Alberta", callback_data: "alb" }],
                    [{ text: "British Columbia", callback_data: "bc" }],
                    [{ text: "Manitoba", callback_data: "man" }],
                    [{ text: "New Brunswick", callback_data: "nb" }],
                    [{ text: "Newfoundland and Labrador", callback_data: "nfl" }],
                    [{ text: "Northwest Territories", callback_data: "nt" }],
                    [{ text: "Nova Scotia", callback_data: "ns" }],
                    [{ text: "Ontario", callback_data: "ont" }],
                    [{ text: "Prince Edward Island", callback_data: "pei" }],
                    [{ text: "Quebec", callback_data: "qc" }],
                    [{ text: "Saskatchewan", callback_data: "sk" }],
                    [{ text: "Yukon", callback_data: "yk" }],
                    [{ text: "Back to Main Menu", callback_data: "main_menu" }],
                ]
            }
        }
        bot.sendMessage(chatId, "Provincial Nomination Programs (PNP) are...", subMenu);
        
    } else if (query.data === "alb"){
        bot.sendMessage(chatId, "Alberta's Provincial Nomination Program (PNP) is... https://www.alberta.ca/alberta-advantage-immigration-program", backToPNPMenu);
    } else if (query.data === "bc"){
        bot.sendMessage(chatId, "British Columbia's Provincial Nomination Program (PNP) is... https://www.welcomebc.ca/immigrate-to-b-c/about-the-bc-provincial-nominee-program", backToPNPMenu);
    } else if ( query.data === "man"){
        bot.sendMessage(chatId, "Manitoba's Provincial Nomination Program (PNP) is... https://www.immigratemanitoba.com/", backToPNPMenu);
    } else if ( query.data === " nb"){
        bot.sendMessage(chatId, "New Brunswick's Provincial Nomination Program (PNP) is... https://www2.gnb.ca/content/gnb/en/corporate/promo/immigration/immigrating-to-nb/nb-immigration-program-streams.html", backToPNPMenu);
    } else if ( query.data === "nfl"){
        bot.sendMessage(chatId, "Newfoundland and Labrador's Provincial Nomination Program (PNP) is... https://www.gov.nl.ca/immigration/immigrating-to-newfoundland-and-labrador/provincial-nominee-program/overview/", backToPNPMenu);
    } else if ( query.data === "nt"){
        bot.sendMessage(chatId, "Northwest Territories' Provincial Nomination Program (PNP) is... https://www.immigratenwt.ca/immigrate-here", backToPNPMenu);
    } else if ( query.data === "ns"){
        bot.sendMessage(chatId, "Nova Scotia's Provincial Nomination Program (PNP) is... https://liveinnovascotia.com/nova-scotia-nominee-program/", backToPNPMenu);
    } else if ( query.data === "ont"){
        bot.sendMessage(chatId, "Ontario's Provincial Nomination Program (PNP) is... https://www.ontario.ca/page/immigrate-to-ontario", backToPNPMenu);
    } else if ( query.data === "pei"){
        bot.sendMessage(chatId, "Prince Edward Island's Provincial Nomination Program (PNP) is... https://www.princeedwardisland.ca/en/information/office-of-immigration/provincial-nominee-program", backToPNPMenu);
    } else if ( query.data === "qc"){
        bot.sendMessage(chatId, "Quebec's Provincial Nomination Program (PNP) is... https://www.quebec.ca/en/immigration/permanent/skilled-workers/regular-skilled-worker-program", backToPNPMenu);
    } else if ( query.data === "sk"){
        bot.sendMessage(chatId, "Saskatchewan's Provincial Nomination Program (PNP) is... https://www.saskatchewan.ca/residents/moving-to-saskatchewan", backToPNPMenu);
    } else if ( query.data === "yk"){
        bot.sendMessage(chatId, "Yukon's Provincial Nomination Program (PNP) is... https://yukon.ca/immigrate-yukon", backToPNPMenu);
    } else if (query.data === "main_menu"){
        bot.sendMessage(chatId, "🤖🇨🇦 Welcome to the IRCC News Bot FAQ! 🇨🇦🤖", mainMenu); 
    }
})