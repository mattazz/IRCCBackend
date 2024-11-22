const axios = require('axios')
const Parser = require('rss-parser')
const utils = require('./utils')


const irccNewsURL = "https://api.io.canada.ca/io-server/gc/news/en/v2?dept=departmentofcitizenshipandimmigration&sort=publishedDate&orderBy=desc&publishedDate%3E=2021-07-23&pick=50&format=atom&atomtitle=Immigration,%20Refugees%20and%20Citizenship%20Canada"
// Month mapping
const monthMapping = {
    jan: 0, january: 0,
    feb: 1, february: 1,
    mar: 2, march: 2,
    apr: 3, april: 3,
    may: 4,
    jun: 5, june: 5,
    jul: 6, july: 6,
    aug: 7, august: 7,
    sep: 8, september: 8,
    oct: 9, october: 9,
    nov: 10, november: 10,
    dec: 11, december: 11
};

/**
 * Fetches the full IRCC news feed from the specified URL.
 * 
 * @returns {Promise<Object>} The full IRCC news feed.
 */
async function fetchFullIRCCFeed() {
    let parser = new Parser();
    let feed = await parser.parseURL(irccNewsURL);

    // console.log(feed.title);

    feed.items.forEach(item => {
        // console.log(item);
    })
    return feed
    
}

/**
 * Validates the user input for the month and returns the month number or month string.
 * 
 * @param {*} input_month String input for the month.
 * @param {*} returnType [String or Number]. Default is number.
 * @returns  The month number or month string.
 */
function validateUserMonthInput(input_month, returnType = "number"){
    let input_month_lower = input_month.toLowerCase();
    let input_month_num = monthMapping[input_month_lower];
    if (input_month_num === undefined) {
        throw new Error("Invalid Month");
    }

    if (returnType === "string") {
        return input_month_lower;
    } else{
        return input_month_num
    }
}

/**
 * Fetches the IRCC news feed for the specified month.
 * 
 * @param {*} input_month The month to filter the news feed.
 * @returns {Promise<Array>} An array of objects containing the news feed for the specified month.
 */
async function fetchIRCCFeed_Monthly(input_month){
    let parser = new Parser
    let feed = await fetchFullIRCCFeed();

    // validate input month
    let input_month_lower = validateUserMonthInput(input_month);

    let currentYear = new Date().getFullYear();

    // Filter items based on the current month and year
    let monthlyItems = feed.items.filter(item =>{
        let itemDate = new Date(item.pubDate);
        return itemDate.getMonth() === input_month_lower && itemDate.getFullYear() === currentYear;
    })

    return monthlyItems
}

async function keywordSearchIRCCFeed(keyword){
    let feed = await fetchFullIRCCFeed();

    // Filter item.title based on the keyword
    let keywordItems = feed.items.filter(item =>{
        return item.summary.toLowerCase().includes(keyword.toLowerCase());
    })


    return keywordItems
}

module.exports = {
    fetchFullIRCCFeed,
    fetchIRCCFeed_Monthly,
    validateUserMonthInput,
    keywordSearchIRCCFeed
}
