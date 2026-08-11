import express from 'express';
import bodyParser from 'body-parser';
import cors from 'cors';
import TelegramBot from 'node-telegram-bot-api';

import rssParser from './src/utils/rssParser.js';
import logger from './src/middleware/logger.js';
import irccDrawScraper from './src/utils/irccDrawScraper.js';
import chartGenerator from './src/utils/chartGenerator.js';
import irccDrawAnalyzer from './src/utils/irccDrawAnalyzer.js';
import utils from './src/utils/utils.js';
import speechNewsParser from './src/utils/speechNewsParser.js';
import mongoDBConnect from './src/utils/mongoDBConnect.js';
import dataCache from './src/utils/dataCache.js';
import apiRouter from './src/routes/api.js';

import dotenv from 'dotenv';
dotenv.config();

const app = express()
app.use(bodyParser.json())

/**
 * CORS: any localhost origin (any port) is always allowed, for local frontend dev.
 * Non-local origins must be listed in FRONTEND_ORIGIN (comma-separated) - update that
 * env var once the frontend has a real domain (e.g. once it's staged on Heroku).
 */
const localhostOriginRegex = /^https?:\/\/localhost(:\d+)?$/;
const allowedOrigins = (process.env.FRONTEND_ORIGIN || '')
    .split(',')
    .map(origin => origin.trim())
    .filter(Boolean);

app.use(cors({
    origin: (origin, callback) => {
        // No Origin header = non-browser request (curl, server-to-server, Telegram webhook) - always allow.
        if (!origin || localhostOriginRegex.test(origin) || allowedOrigins.includes(origin)) {
            return callback(null, true);
        }
        return callback(new Error(`Origin ${origin} not allowed by CORS`));
    }
}))

// Connect to DB once at startup and keep the connection alive for the life of the
// process (mongoose queues queries until connected, so this doesn't block routes below).
mongoDBConnect.connectToDatabase().catch(error => {
    console.error('Initial database connection failed:', error);
});

// Populate the news/draws cache immediately and keep it refreshed on an interval,
// so /api/* routes never trigger a live IRCC fetch in the request path.
dataCache.startCacheRefresh();

// Port
const port = process.env.PORT || 3000

// Routes

app.get('/', (req, res) => {
    res.send('Hello, this is the IRCC News Bot server.');
});

app.use('/api', apiRouter);

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

// Set up command menu
bot.setMyCommands([
    { command: '/help', description: 'Get the bot commands' },
    { command: '/latest_news', description: 'Get the latest news' },
    { command: '/search_news', description: 'Search for news by keyword (ex. /search_news Express Entry)' },
    { command: '/month', description: 'Get news for a specific month (ex. /month January)' },
    { command: '/latest_speech', description: 'Get the last 10 official speeches' },
    { command: '/last_draws', description: 'Get the last 5 IRCC draws' },
    { command: '/draws', description: 'Get the last [number] IRCC draws (ex. /draws 10)' },
    { command: '/filter_draws', description: 'Filter draws by class (ex. /filter_draws CEC)' },
    { command: '/faq', description: 'Open the submenu for the frequently asked questions resources.' }
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

    FAQ:
    - /faq - Open the submenu for the frequently asked questions resources. 

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

    FAQ:
    - /faq - Open the submenu for the frequently asked questions resources. 

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

bot.onText(/\/latest_news/, async (msg) => {
    const chatId = msg.chat.id;

    logger.logUserInteraction(bot, msg);
    const logString = logger.parseLogToString(bot, msg);
    logger.sendLogToPrimary(bot, process.env.ADMIN_USER_ID, logString);

    // get latest month
    let input_month = new Date().toLocaleString('default', { month: 'long' });

    try {
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


bot.onText(/\/full/, async (msg) => {
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

bot.onText(/\/latest_speech/, async(msg) =>{
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

bot.onText(/\/last_draws/, async (msg) => {
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

const classFilterMap = utils.classFilterMap;

bot.onText(/\/filter_draws (.+)/, async (msg, match) => {
    const chatId = msg.chat.id;
    const filterCode = match[1]; //captured regex response

    if(!classFilterMap[filterCode.toUpperCase()]){
        await bot.sendMessage(chatId, "⁉ Invalid filter code. Please use a valid code (see /help for the list of valid codes).");
        return
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



        if (analyzedData.length === 0) {
            await bot.sendMessage(chatId, "⁉ There is no subclass data to analyze the rolling average CRS.");
            return
        } else if (analyzedData.length < 2) {
            await bot.sendMessage(chatId, "⁉ Not enough specific draw class data to analyze the rolling average CRS.");
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

/** 
 * Creating sub menus
 */

const menuContainer = {
    mainMenu: {
        reply_markup: {
            inline_keyboard: [
                [{ text: "How do I use the FAQ Section?", callback_data: "how" }],
                [{ text: "Immigrating through Express Entry", callback_data: "ee" }],
                [{ text: "Learn about Provincial Nomination Programs", callback_data: "pnp" }],
            ]
        }
    },
    justBackToMainMenu: {
        reply_markup: {
            inline_keyboard: [
                [{ text: "⏪ Back to Main Menu", callback_data: "main_menu" }],
            ]
        }
    },
    backToPNPMenu: {
        reply_markup: {
            inline_keyboard: [
                [{ text: "⏪ Back to PNP Menu", callback_data: "pnp" }],
                [{ text: "⏪ Back to Main Menu", callback_data: "main_menu" }],
            ]
        }
    },
    backToEEMenu: {
        reply_markup: {
            inline_keyboard: [
                [{ text: "⏪ Back to Express Entry Menu", callback_data: "ee" }],
                [{ text: "⏪ Back to Main Menu", callback_data: "main_menu" }],
            ]
        }
    },
    backToEEPrograms: {
        reply_markup: {
            inline_keyboard: [
                [{ text: "⏪ Back to Express Entry Programs", callback_data: "ee_progs" }],
                [{ text: "⏪ Back to Express Entry Menu", callback_data: "ee" }],
                [{ text: "⏪ Back to Main Menu", callback_data: "main_menu" }],
            ]
        }
    }
}

bot.onText(/\/faq/, (msg) => {
    logger.logUserInteraction(bot, msg);
    const chatId = msg.chat.id;

    bot.sendMessage(chatId, "🤖🇨🇦 Welcome to the IRCC News Bot FAQ! 🇨🇦🤖", menuContainer.mainMenu);
})

// Handle callback queries
bot.on('callback_query', async (query) => {
    const chatId = query.message.chat.id;

    /**
     * How do I use the FAQ Section?
     */
    if (query.data === "how") {
        bot.sendMessage(chatId, "✅ Click on the menu buttons below to navigate through the FAQ sections. More resources will be added in the future. ", menuContainer.mainMenu);
    }
    /**
     * Immigrating through Express Entry
     */

    else if (query.data === "ee") {
        const subMenu = {
            reply_markup: {
                inline_keyboard: [
                    [{ text: "What are the general requirements for Express Entry?", callback_data: "ee_req" }],
                    [{ text: "What are the Express Entry programs available?", callback_data: "ee_progs" }],
                    [{ text: "How do I improve my CRS score?", callback_data: "ee_crs" }],
                    [{ text: "⏪ Back to Main Menu", callback_data: "main_menu" }],
                ]
            }
        }
        await bot.sendMessage(chatId, `Express Entry is an online system that IRCC uses to manage immigration applications from skilled workers.

There are 3 main immigration programs managed through Express Entry:

✅ Canadian Experience Class

✅ Federal Skilled Worker Program

✅ Federal Skilled Trades Program
`);
        await bot.sendMessage(chatId, "To know more, visit the official IRCC site here: https://www.canada.ca/en/immigration-refugees-citizenship/services/immigrate-canada/express-entry/works.html", subMenu);
    }
    /**
     * EE Requirements
     * [ ] Fill in requirements
     * 
     */
    else if (query.data === "ee_req") {
        await bot.sendMessage(chatId, `To be eligible for Express Entry, you must meet certain requirements provided by the government.

These requirements are based on factors such as:
✅ nationality
✅ age
✅ language ability
✅ family members
✅ education
✅ work experience
✅ available funds
✅ details on any job offer
            `);

        await bot.sendMessage(chatId, `🛠️ IRCC provides an eligibility tool where you will be asked certain questions to determine eligibility.

You can find the tool here: https://www.canada.ca/en/immigration-refugees-citizenship/services/come-canada-tool-immigration-express-entry.html
`, menuContainer.backToEEMenu);
    }

    else if (query.data === "ee_progs") {
        const subMenu = {
            reply_markup: {
                inline_keyboard: [
                    [{ text: "Canadian Experience Class", callback_data: "cec" }],
                    [{ text: "Federal Skilled Worker Program", callback_data: "fsw" }],
                    [{ text: "Federal Skilled Trades Program", callback_data: "fst" }],
                    [{ text: "⏪ Back to Main Menu", callback_data: "main_menu" }],
                ]
            }
        }
        await bot.sendMessage(chatId, `
        🇨🇦 There are 3 immigration programs managed through Express Entry:

✅ Canadian Experience Class
✅ Federal Skilled Worker Program
✅ Federal Skilled Trades Program

Click on any of the buttons below to learn more about each program. ↓
`, subMenu)
    }
    else if (query.data === "ee_crs") {
        await bot.sendMessage(chatId, `🇨🇦 As stated in the IRCC website, to improve your CRS score, you can:

While you’re in the pool, you can improve your score and increase your chances of being invited to apply by:

✅ getting a valid job offer by

✅ using Job Bank

✅ promoting yourself to employers in Canada using private-sector job boards

✅ contacting provinces and territories and asking them to consider you for a Provincial Nominee Program

✅ improving your language score

✅ improving your education

✅ gaining more skilled work experience

❓ You can find out more here: https://www.canada.ca/en/immigration-refugees-citizenship/services/immigrate-canada/express-entry/submit-profile/waiting-pool.html#improve
`, menuContainer.backToEEMenu)
    }
    /**
     * Fill in this part
     */

    else if (query.data === "cec") {


        await bot.sendMessage(chatId, `🇨🇦 The Canadian Experience Class 🇨🇦
            
The Canadian Experience Class is for skilled workers who have Canadian work experience and want to become permanent residents.

> To be eligible, you must meet all the minimum requirements for:

✅ Canadian skilled work experience
✅ language ability

> There is no education requirement for the Canadian Experience Class but you can earn points for education if you have it.

✅ If you went to school in Canada, you can get points for a certificate, diploma or degree from a Canadian
✅ If you have foreign education 

> You must be admissible to Canada.

For more information, visit the official IRCC page: https://www.canada.ca/en/immigration-refugees-citizenship/services/immigrate-canada/express-entry/eligibility/canadian-experience-class.html
`, menuContainer.backToEEPrograms)
    }
    else if (query.data === "fsw") {
        await bot.sendMessage(chatId, `🇨🇦 The Foreign Skilled Worker Program`)
        await bot.sendMessage(chatId, `👷‍♂️ The Federal Skilled Worker Program is for skilled workers who have work experience and want to become permanent residents. 🔨`)

        await bot.sendMessage(chatId, `📝 In general, you must:

✅ Meet all the minimum requirements for:

- skilled work experience
- language ability
- education

✅ Skilled work in TEER 0 / 1 / 2 / 3 (Must show proof of work experience)

✅ Language ability in English or French (Must show proof of language ability)

✅ If you went to school in Canada, you must have a certificate, diploma or degree from a Canadian

- secondary institution (high school) or
- post-secondary institution

❓If you have foreign education, you must have

- a completed educational credential and
- an Educational Credential Assessment for immigration purposes that is from a designated organization 
`)

        await bot.sendMessage(chatId, `❓ To know the exact requirements of the Federal Skilled Worker Program, visit the official IRCC page: https://www.canada.ca/en/immigration-refugees-citizenship/services/immigrate-canada/express-entry/eligibility/federal-skilled-workers.html`, menuContainer.backToEEPrograms)


    }
    else if (query.data === "fst") {
        await bot.sendMessage(chatId, `🇨🇦 The Federal Skilled Trades Program`)
        await bot.sendMessage(chatId, `👷‍♂️ The Federal Skilled Trades Program is for skilled workers who want to become permanent residents based on being qualified in a skilled trade. 🔨`)
        await bot.sendMessage(chatId, `📝 In general, you must:
✅ Meet all the minimum requirements for your

- skilled trades work experience
- job offer or certificate of qualification
- language ability

✅ Skill Trades work experience
- have at least 2 years of full-time work experience (or an equal amount of part-time work experience) in a skilled trade within the 5 years before you apply
- meet the job requirements for that skilled trade as set out in the National Occupational Classification (NOC)
- show that you performed:
    🔨 the actions in the lead statement of the occupational description in the NOC
    🔨 most of the main duties listed

✅ Job offer or certificate of qualification
- valid job offer of full-time employment for a total period of at least 1 year or
- certificate of qualification in your skilled trade issued by a Canadian provincial, territorial or federal authority

✅ Certificate of qualification
- A certificate of qualification proves you’re qualified to work in a certain skilled trade in Canada. This means you:
    📝 passed a certification exam
    📝 meet all the requirements to practise your trade in the province or territory that issued your certificate

- This certificate is issued by
    📝 the provincial or territorial body that governs trades in their province or territory, or
a federal authority

✅ Language ability in English or French (Must show proof of language ability)

✅ If you went to school in Canada, you must have a certificate, diploma or degree from a Canadian

- secondary institution (high school) or
- post-secondary institution

✅ Proof of funds to support yourself and your family
`)

        await bot.sendMessage(chatId, `❓ To know the exact requirements of the Federal Skilled Trades Program, visit the official IRCC page: https://www.canada.ca/en/immigration-refugees-citizenship/services/immigrate-canada/express-entry/eligibility/skilled-trades.html`, menuContainer.backToEEPrograms)
    }



    /**
     * Learn about Provincial Nomination Programs
     */
    else if (query.data === "pnp") {
        const subMenu = {
            reply_markup: {
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
        await bot.sendMessage(chatId, "Which Provincial Nomination Program do you want to know more about?", subMenu);

    } else if (query.data === "alb") {
        await bot.sendMessage(chatId, `
            🇨🇦 The Alberta Advantage Immigration Program (AAIP) is an economic immigration program that nominates people for permanent residence in Alberta. Nominees must have skills to fill job shortages or be planning to buy or start a business in Alberta. They must also be able to provide for their families. The program is run by the governments of Alberta and Canada.
            
If you are nominated through the program, you may apply for permanent residence status together with your spouse or common-law partner, and dependent children.`)
        await bot.sendMessage(chatId, "🧐 You can find more about Alberta's Provincial Nomination Program (PNP) here: https://www.alberta.ca/alberta-advantage-immigration-program", menuContainer.backToPNPMenu);
    } else if (query.data === "bc") {
        await bot.sendMessage(chatId, `
            🇨🇦 The BC Provincial Nominee Program (BC PNP) is an economic immigration program. It lets the Province select economic immigrants who will live in B.C. and help fill job vacancies or operate businesses.

If you are nominated, you and your family can apply to Immigration, Refugees and Citizenship Canada (IRCC) for permanent residence in Canada.`)
        await bot.sendMessage(chatId, "🧐 You can find more about British Columbia's Provincial Nomination Program (PNP): https://www.welcomebc.ca/immigrate-to-b-c/about-the-bc-provincial-nominee-program", menuContainer.backToPNPMenu);
    } else if (query.data === "man") {
        await bot.sendMessage(chatId, `
            🇨🇦 The Manitoba Provincial Nominee Program (MPNP) offers three streams, with their respective pathways, through which you can immigrate to the province of Manitoba and become a permanent resident of Canada.
`)
        await bot.sendMessage(chatId, "🧐 You can find more about Manitoba's Provincial Nomination Program (PNP) here: https://www.immigratemanitoba.com/", menuContainer.backToPNPMenu);
    } else if (query.data === "nb") {
        await bot.sendMessage(chatId, `
            🇨🇦 New Brunswick’s immigration program streams are pathways to permanent residence (PR) for foreign workers who have the skills, education, and work experience necessary to successfully contribute to New Brunswick’s economy.

When applying to many of these programs, you must be PR ready. This means that you meet all minimum eligibility requirements and have all the required documents on hand to prepare and submit a complete and correct application to the province of New Brunswick and to the Government of Canada.

`)
        await bot.sendMessage(chatId, "🧐 You can find more about New Brunswick's Provincial Nomination Program (PNP) here: https://www2.gnb.ca/content/gnb/en/corporate/promo/immigration/immigrating-to-nb/nb-immigration-program-streams.html", menuContainer.backToPNPMenu);
    } else if (query.data === "nfl") {
        await bot.sendMessage(chatId, `
            🇨🇦 The Newfoundland and Labrador Provincial Nominee Program (NLPNP) is an economic immigration program intended for:

✅ Newfoundland and Labrador employers with labour market challenges
✅ Skilled workers, international graduates and entrepreneurs interested in settling in Newfoundland and Labrador

The Newfoundland and Labrador Provincial Nominee Program (NLPNP) facilitates the immigration of individuals who can make a positive contribution to the province’s economy and who intend to permanently settle with their families in the province of Newfoundland and Labrador. Successful applicants may become permanent residents of Canada.

`)
        await bot.sendMessage(chatId, "🧐 You can find more about Newfoundland and Labrador's Provincial Nomination Program (PNP) here: https://www.gov.nl.ca/immigration/immigrating-to-newfoundland-and-labrador/provincial-nominee-program/overview/", menuContainer.backToPNPMenu);
    } else if (query.data === "nt") {
        await bot.sendMessage(chatId, `🇨🇦 To immigrate here through the Northwest Territories Nominee Program, you need to either:

✅ be ready to open, purchase or invest in a business in the NWT; or
✅ have a job offer from an employer in the NWT.
`)
        await bot.sendMessage(chatId, "🧐 You can find more about Northwest Territories' Provincial Nomination Program (PNP) here: https://www.immigratenwt.ca/immigrate-here", menuContainer.backToPNPMenu);
    } else if (query.data === "ns") {
        await bot.sendMessage(chatId, `
            🇨🇦 Once you're ready to move to beautiful Nova Scotia you will want to apply to a Nova Scotia Nominee Program (NSNP) stream. Through the NSNP, prospective immigrants who have the skills and experience needed by Nova Scotia employers may be nominated to immigrate.
`)
        await bot.sendMessage(chatId, "🧐 You can find more about Nova Scotia's Provincial Nomination Program (PNP) here: https://liveinnovascotia.com/nova-scotia-nominee-program/", menuContainer.backToPNPMenu);
    } else if (query.data === "ont") {
        await bot.sendMessage(chatId, `
            🇨🇦 The OINP nominates foreign workers, entrepreneurs and international students to the Government of Canada for permanent residence in Ontario.

Ontario's economic immigration program works in partnership with the Canadian government's immigration pathways.
`)
        await bot.sendMessage(chatId, "🧐 You can find more about Ontario's Provincial Nomination Program (PNP) here: https://www.ontario.ca/page/immigrate-to-ontario", menuContainer.backToPNPMenu);
    } else if (query.data === "pei") {
        await bot.sendMessage(chatId, `🇨🇦 If you are seeking permanent residency in Prince Edward Island, one pathway is to be nominated to the federal government through the PEI Provincial Nominee Program (PNP). Individuals are selected for nomination based on their intention to live and work in PEI and their economic ability to establish here. At this time, priority will be given to entrepreneurs and to individuals qualified to work in areas with identified skill shortages in the PEI labour market.
`)
        await bot.sendMessage(chatId, "🧐 You can find more about Prince Edward Island's Provincial Nomination Program (PNP) here: https://www.princeedwardisland.ca/en/information/office-of-immigration/provincial-nominee-program", menuContainer.backToPNPMenu);
    } else if (query.data === "qc") {
        await bot.sendMessage(chatId, `🇨🇦 This program is for people who wish to immigrate to Québec as a skilled worker, whether they are in Québec or abroad.
`)
        await bot.sendMessage(chatId, "🧐 You can find more about Quebec's Provincial Nomination Program (PNP) here: https://www.quebec.ca/en/immigration/permanent/skilled-workers/regular-skilled-worker-program", menuContainer.backToPNPMenu);
    } else if (query.data === "sk") {
        await bot.sendMessage(chatId, "🧐 You can find more about Saskatchewan's Provincial Nomination Program (PNP) here: https://www.saskatchewan.ca/residents/moving-to-saskatchewan/live-in-saskatchewan/by-immigrating/saskatchewan-immigrant-nominee-program", menuContainer.backToPNPMenu);
    } else if (query.data === "yk") {
        await bot.sendMessage(chatId, `
            🇨🇦 The Yukon Nominee Program accepts applications for nominee candidates both inside and outside of Canada. To qualify for the Yukon Nominee Program, you must:

✅ have a full-time and year-round job offer from an eligible Yukon employer; and
✅ meet the specific criteria of your application stream.

To qualify for the Yukon Business Nominee Program, you must meet the eligibility requirements.

You are not eligible if you're:

❌ a refugee claimant; or
❌ inadmissible to Canada.
`)
        await bot.sendMessage(chatId, "🧐 You can find more about Yukon's Provincial Nomination Program (PNP) here: https://yukon.ca/immigrate-yukon", menuContainer.backToPNPMenu);
    } else if (query.data === "main_menu") {
        await bot.sendMessage(chatId, "🤖🇨🇦 Welcome to the IRCC News Bot FAQ! 🇨🇦🤖", menuContainer.mainMenu);
    }
})