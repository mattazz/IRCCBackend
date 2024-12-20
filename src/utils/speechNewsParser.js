import puppeteer from 'puppeteer';
import SpeechArticle from '../models/speechArticle.js';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { dirname } from 'path';
import { fileURLToPath } from 'url';
import mongoDBConnect from './mongoDBConnect.js'

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: "../../.env" })

const MAX_RETRIES = 8;

/** Scrapes the IRCC speeches news feed.
 * 
 * @returns {Promise<Array>} An array of objects containing the scraped speech news.
 */
async function scrapeSpeechNews(retries = 0) {
    console.log(`[scrapeSpeechNews] => Starting scraping...`);
    

    const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox'] });
    const page = await browser.newPage();

    const url = "https://www.canada.ca/en/news/advanced-news-search/news-results.html?typ=speeches&dprtmnt=departmentofcitizenshipandimmigration&start=2015-01-01&end="

    try{
        await page.goto(url, {waitUntil: 'networkidle2', timeout: 60000});
    } catch(error){
        console.log(`[scrapeSpeechNews] => Error during page.goto: ${error}`);
        if(retries < MAX_RETRIES){
            console.log(`[scrapeSpeechNews] => Retrying... (${retries + 1}/${MAX_RETRIES})`);
            await browser.close();
            return scrapeSpeechNews(retries + 1);
        } else{
            console.error(`[scrapeSpeechNews] => Failed after ${MAX_RETRIES} retries.`);
            await browser.close();
            throw error;
        }
    }


    /**
     * Structure: 
     * <article.item>
     *  <h3.h5>
     *<a>
     *      [Link to article]
     *    </a>
     *    [Title of article]
     *  </h3>
     *  <p>
     *    <time>
     *      [Date of article]
     *    </time>
     *    [category text]
     *  </p>
     *  <p>
     *   [Short Summary]
     * </p>
     * 
     * </article>
     */

    const parsedArticles = [];

    const articleSelector = 'article.item';
    const headingSelector = 'h3.h5';
    const linkSelector = 'a';
    const dateSelector = 'p' //this is outside the heading
    const summarySelector = 'p' //this is outside the date


    try {
        const articles = await page.$$(articleSelector);

        for (const article of articles) { //gets list of h3.h5
            console.log(`Scraping article...`);

            const parsedArticle = {};
            //First layer scrape
            const heading = await article.$(headingSelector);

            if (heading) {
                // Gets heading text -> Title
                const headingText = await page.evaluate(heading => heading.textContent, heading);
                parsedArticle.title = headingText;

                const link = await heading.$(linkSelector);
                if (link) {
                    const linkText = await page.evaluate(link => link.textContent, link)
                    const linkHref = await page.evaluate(link => link.href, link)
                    parsedArticle.link = linkHref;
                }

                // Second layer scrape
                const date = await article.$(dateSelector);
                if (date) {
                    const dateText = await page.evaluate(date => date.textContent, date);
                    const dateMatch = dateText.match(/\d{4}-\d{2}-\d{2}/); // Extracts date in YYYY-MM-DD format
                    if (dateMatch) {
                        parsedArticle.date = dateMatch[0];
                    }
                }

                // Third layer scrape
                const summary = await article.$$('p')
                if (summary.length > 1) {
                    const summaryText = await page.evaluate(p => p.textContent, summary[1]);
                    parsedArticle.summary = summaryText;
                }
            }
            console.log(`Adding article to list...`);
            parsedArticles.push(parsedArticle);
        }
        console.log(`Scraping complete for ${parsedArticles.length} articles.`);
        return parsedArticles; //list of objects
    } catch (error) {
        console.error(`Error during scraping: ${error}`);
    } finally {
        await browser.close();
    }
}

/**
 * 
 * @param {Object} articleObject An object containing the article information.
 */
async function pushOneToDB(articleObject) {
    try {
        mongoose.connect(`mongodb+srv://mattazz:${process.env.MONGODB_PASSWORD}@testing.h0pbt.mongodb.net/telegram_bot?retryWrites=true&w=majority&appName=Testing`)

        const speechArticle = new SpeechArticle({
            title: articleObject.title,
            url: articleObject.link,
            date: articleObject.date,
            summary: articleObject.summary
        })
        await speechArticle.save();
    } catch (error) {
        console.error(`[pushOneToDB] => Error during database connection: ${error}`);
    } finally {
        mongoose.connection.close();
    }
}
/**
 * 
 * @param {Array<Object>} articleList a list of Objects with the structure {title: string, link: string, date: string, summary: string}
 */
async function pushAllToDB(articleList) {
    try {
        console.log(`[pushAllToDB] => Connecting to database...`);
        // await mongoose.connect(`mongodb+srv://mattazz:${process.env.MONGODB_PASSWORD}@testing.h0pbt.mongodb.net/telegram_bot?retryWrites=true&w=majority&appName=Testing`)
        await mongoDBConnect.connectToDatabase();
        console.log(`[pushAllToDB] => Deleting all documents...`);
        
        await deleteAllDocuments();

        console.log(`[pushAllToDB] => Pushing to database...`);
        
        for (const article of articleList) {
            console.log(`Pushing to database...`);
            const speechArticle = new SpeechArticle({
                title: article.title,
                url: article.link,
                date: article.date,
                summary: article.summary
            })
            await speechArticle.save();
            console.log(`Pushed ${article.title} to database.`);
        }
    } catch (error) {
        console.error(`[pushAllToDB] => Error during database connection: ${error}`);
    } finally {
        // await mongoose.connection.close();
        await mongoDBConnect.closeDatabaseConnection();
        console.log(`Disconnected from database.`);
    }
}

/**
 * Deletes all documents in the collection.
 */
async function deleteAllDocuments() {
    try {
        console.log(`[deleteAllDocuments] => Deleting all documents...`);
        await SpeechArticle.deleteMany({});
        console.log(`[deleteAllDocuments] => Deleted all documents.`);
    } catch (error) {
        console.error(`[deleteAllDocuments] => Error during database connection: ${error}`);
    }
}

/**
 * Used for worker threads to scrape and push to database on a schedule.
 */
async function scheduledScrapeAndPush() {
    let result = await scrapeSpeechNews();
    if (result.length === 0) {
        console.log(`[scheduledScrapeAndPush] => No articles found.`);
        return;
    } else if (result.length > 0) {
        console.log(`[scheduledScrapeAndPush] => Found ${result.length} articles.`);
    }
    console.log(`[scheduledScrapeAndPush] => Pushing to database...`);
    await pushAllToDB(result);
}

/**
 * 
 * @returns {Promise<Array>} An array of objects containing the stored speech articles.
 */
async function getStoredSpeechArticles() {
    try {
        await mongoose.connect(`mongodb+srv://mattazz:${process.env.MONGODB_PASSWORD}@testing.h0pbt.mongodb.net/telegram_bot?retryWrites=true&w=majority&appName=Testing`)
        // mongoDBConnect.connectToDatabase();
        const articles = await SpeechArticle.find({});
        return articles;
    } catch (error) {
        console.error(`Error during database connection: ${error}`);
    } finally {
        await mongoose.connection.close();
        // mongoDBConnect.closeDatabaseConnection();
    }
}

export default {scrapeSpeechNews, scheduledScrapeAndPush, getStoredSpeechArticles};