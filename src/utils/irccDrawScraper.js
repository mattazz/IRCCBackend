
const { match } = require('assert')
const axios = require('axios')
const fs = require('fs')

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
        
        // only get the last 5 draws
        const limitedDraws = result.rounds.slice(0, max_draw)

        parsedDrawArray = []

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
        return parsedDrawArray
    } catch (error) {
        console.error("ERRORRRRR: " + error)
    }

    // console.log("Result:", JSON.stringify(result, null, 2));



    
}

/**
 * Filters the draws based on the specified filter and returns the last 10 draws.
 * 
 * @param {*} filter String filter to apply to the draws.
 * @param {*} max_num  Maximum number of draws to return.
 * @returns 
 */
const filterDraws = async (filter = "CEC", max_num = 10) => {
    const parsedDraws = await parseDraws(max_num);

    classFilterMap = {
        "CEC": "Canadian Experience Class",
        "FSW": "Federal Skilled Worker",
        "FST": "Federal Skilled Trades",
        "PNP": "Provincial Nominee Program",
        "FLP": "French language proficiency",
        "TO": "Trade occupations",
        "HO": "Healthcare occupations",
        "STEM": "STEM occupations",
        "GEN" : "General",
        "TRAN": "Transport occupations",
        "AGRI": "Agriculture and agri-food occupations",
    }


    let filteredDraws = parsedDraws.filter(draw => draw.class.includes(classFilterMap[filter]))

    let subclassFilteredDraws = parsedDraws.filter(draw => draw.subclass.includes(classFilterMap[filter]))
    if (filteredDraws.length < 10){
        subclassFilteredDraws = parsedDraws.filter(draw => draw.subclass.includes(classFilterMap[filter]))
    } else{
        subclassFilteredDraws = []
    }
    
    return [filteredDraws, subclassFilteredDraws]

}

module.exports = {
    parseDraws,
    filterDraws,
}