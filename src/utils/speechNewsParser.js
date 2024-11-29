import puppeteer from 'puppeteer';
import SpeechArticle from '../models/speechArticle.js';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: "../../.env" })

/** Scrapes the IRCC speeches news feed.
 * 
 * @returns {Promise<Array>} An array of objects containing the scraped speech news.
 */
async function scrapeSpeechNews() {
    console.log("Starting to scrape...");

    const browser = await puppeteer.launch({ headless: true });
    const page = await browser.newPage();

    const url = "https://www.canada.ca/en/news/advanced-news-search/news-results.html?typ=speeches&dprtmnt=departmentofcitizenshipandimmigration&start=2015-01-01&end="

    await page.goto(url);

    /**
     * Structure: 
     * <article.item>
     *  <h3.h5>
     *    <a>
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
        console.error(`Error during database connection: ${error}`);
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
        await mongoose.connect(`mongodb+srv://mattazz:${process.env.MONGODB_PASSWORD}@testing.h0pbt.mongodb.net/telegram_bot?retryWrites=true&w=majority&appName=Testing`)

        await deleteAllDocuments();

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
        console.error(`Error during database connection: ${error}`);
    } finally {
        await mongoose.connection.close();
        console.log(`Disconnected from database.`);
    }
}

/**
 * Deletes all documents in the collection.
 */
async function deleteAllDocuments() {
    try {
        console.log(`Deleting all documents...`);
        await SpeechArticle.deleteMany({});
        console.log(`Deleted all documents.`);
    } catch (error) {
        console.error(`Error during database connection: ${error}`);
    }
}

/**
 * Used for worker threads to scrape and push to database on a schedule.
 */
async function scheduledScrapeAndPush() {
    let result = await scrapeSpeechNews();
    pushAllToDB(result);
}

/**
 * 
 * @returns {Promise<Array>} An array of objects containing the stored speech articles.
 */
async function getStoredSpeechArticles() {
    try {
        await mongoose.connect(`mongodb+srv://mattazz:${process.env.MONGODB_PASSWORD}@testing.h0pbt.mongodb.net/telegram_bot?retryWrites=true&w=majority&appName=Testing`)
        const articles = await SpeechArticle.find({});
        return articles;
    } catch (error) {
        console.error(`Error during database connection: ${error}`);
    } finally {
        await mongoose.connection.close();
    }
}

export default {scrapeSpeechNews, scheduledScrapeAndPush, getStoredSpeechArticles};