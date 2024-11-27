const puppeteer = require("puppeteer");

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

    const parsedArticle = {
        title: "",
        link: "",
        date: "",
        summary: ""
    }
    const parsedArticles = [];

    const articleSelector = 'article.item';
    const headingSelector = 'h3.h5';
    const linkSelector = 'a';
    const dateSelector = 'p' //this is outside the heading
    const summarySelector = 'p' //this is outside the date


    try {
        const articles = await page.$$(articleSelector);

        for (const article of articles) { //gets list of h3.h5
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
                    if (dateMatch){
                        parsedArticle.date = dateMatch[0];
                    }
                }

                // Third layer scrape
                const summary = await article.$$('p')
                if(summary.length > 1){
                    const summaryText = await page.evaluate(p => p.textContent, summary[1]);
                    parsedArticle.summary = summaryText;
                }                 
            }
            parsedArticles.push(parsedArticle);
        }

        return parsedArticles; //list of objects
    } catch (error) {
        console.error(`Error during scraping: ${error}`);
    } finally {
        await browser.close();
    }
}

module.exports = {
    scrapeSpeechNews
}