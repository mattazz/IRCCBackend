
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
        console.error(error)
    }
}

/**
 * Parses the draw data and returns the last 5 draws.
 * 
 * @param {number} max_draw - The maximum number of draws to return.
 * @returns {Promise<Array>} An array of objects containing the parsed draw data.
 */
const parseDraws = async (max_draw = 5) =>{
    // draws will be a json object
    const result = await getDraws()

    // only get the last 5 draws
    const limitedDraws = result.rounds.slice(0, max_draw)

    parsedDrawArray = []

    for(const draw of limitedDraws){
        parsedDrawArray.push({
            "date": draw.drawDate,
            "drawNumber": draw.drawNumber,
            "crs": draw.drawCRS,
            "class": draw.drawText2,
            "drawSize": draw.drawSize,
        })
    }
    return parsedDrawArray
}

/**
 * Filters the draws based on the specified filter and returns the last 10 draws.
 * 
 * @param {*} filter String filter to apply to the draws.
 * @param {*} max_num  Maximum number of draws to return.
 * @returns 
 */
const filterDraws =async (filter = "CEC", max_num = 10) =>{
    const parsedDraws = await parseDraws(max_num);

    classFilterMap = {
        "CEC": "Canadian Experience Class",
        "FSW": "Federal Skilled Worker",
        "FST": "Federal Skilled Trades",
        "PNP": "Provincial Nominee Program",
    }

    const filteredDraws = parsedDraws.filter(draw => draw.class.includes(classFilterMap[filter]))
    return filteredDraws

}

module.exports = {
    parseDraws,
    filterDraws,
}