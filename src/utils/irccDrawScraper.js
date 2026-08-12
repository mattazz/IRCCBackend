import axios from 'axios';
import utils from './utils.js';

const drawUrl = "https://www.canada.ca/content/dam/ircc/documents/json/ee_rounds_123_en.json"


/**
 * Fetches the latest draw data from the specified URL.
 *
 * @async
 * @function getDraws
 * @returns {Promise<Object>} The JSON data containing the draw information.
 * @throws Will log an error message to the console if the request fails.
 */
const getDraws = async () => {
    try {
        const response = await axios.get(drawUrl)
        return response.data // returns json data
    } catch (error) {        
        console.error("irccDrawScraper.js - getDraws() -" +  error)
    }
}

/**
 * Parses the draw data and returns the last 5 draws.
 * 
 * @param {number} max_draw - The maximum number of draws to return.
 * @returns {Promise<Array>} An array of objects containing the parsed draw data.
 */
const parseDraws = async (max_draw = 5) => {
    // draws will be a json object
    try {
        const result = await getDraws()
        if (!result || !result.rounds) {
            throw new Error("Invalid draw data received");
        }
        
        // only get the last 5 draws
        const limitedDraws = result.rounds.slice(0, max_draw)

        let parsedDrawArray = []

        for (const draw of limitedDraws) {
            const drawDate = new Date(draw.drawDate)
            if (isNaN(drawDate)){
                console.error(`Invalid date format: ${draw.drawDate}`);
                continue
            }
            
            parsedDrawArray.push({
                "date": draw.drawDate,
                "drawNumber": draw.drawNumber,
                "crs": draw.drawCRS,
                "class": draw.drawName,
                "subclass": draw.drawText2,
                "drawSize": draw.drawSize,
            })
    
        }

        if (parsedDrawArray.length === 0) {
            throw new Error("No valid draws found");
        }        
        return parsedDrawArray
    } catch (error) {
        console.error("ERRORRRRR: " + error)
        throw error; // Re-throw to handle in calling function

    }

    // console.log("Result:", JSON.stringify(result, null, 2));



    
}

const classMatchKeywords = utils.classMatchKeywords;

/**
 * Filters an already-fetched list of parsed draws by class filter code.
 * Pure filtering, no network call - shared by the live filterDraws below and by
 * dataCache-backed callers that already have parsed draws in memory.
 *
 * @param {Array} parsedDraws Draws as returned by parseDraws().
 * @param {string} filter Class filter code, e.g. "CEC" (see utils.classMatchKeywords).
 * @returns {[Array, Array]} [classFilteredDraws, subclassFilteredDraws]
 */
const filterParsedDraws = (parsedDraws, filter) => {
    filter = filter.toUpperCase();
    const keyword = (classMatchKeywords[filter] ?? '\0').toLowerCase();

    let filteredDraws = parsedDraws.filter(draw => draw.class.toLowerCase().includes(keyword))
    let subclassFilteredDraws = parsedDraws.filter(draw => draw.subclass.toLowerCase().includes(keyword));

    if (filteredDraws.length < 10) {
        subclassFilteredDraws = parsedDraws.filter(draw => draw.subclass.toLowerCase().includes(keyword))
    } else {
        subclassFilteredDraws = []
    }

    return [filteredDraws, subclassFilteredDraws]
}

/**
 * Filters the draws based on the specified filter and returns the last 10 draws.
 *
 * @param {*} filter String filter to apply to the draws.
 * @param {*} max_num  Maximum number of draws to return.
 * @returns
 */
const filterDraws = async (filter = "CEC", max_num = 10) => {
    try {
        const parsedDraws = await parseDraws(max_num);
        return filterParsedDraws(parsedDraws, filter)
    } catch (error) {
        console.error("Error filtering draws:", error);
        throw error;
    }
}

export default {parseDraws, filterDraws, filterParsedDraws}