/**
 * Formats the date string to a more readable format.
 *
 * @param {*} dateString The date string to format.
 * @returns {String} The formatted date string.
 */
function formatDate(dateString){
    const date = new Date(dateString);
    const options = {year: "numeric", month: 'long', day: 'numeric'};
    return date.toLocaleDateString('en-US', options);
}

/**
 * Maps the short draw filter codes (used in /filter_draws) to their full class name,
 * shared between app.js (command handling) and irccDrawScraper.js (filtering logic).
 */
const classFilterMap = {
    "CEC": "Canadian Experience Class",
    "FSW": "Federal Skilled Worker",
    "FST": "Federal Skilled Trades",
    "PNP": "Provincial Nominee Program",
    "FLP": "French language proficiency",
    "TO": "Trade occupations",
    "HO": "Healthcare occupations",
    "STEM": "STEM occupations",
    "GEN": "General",
    "TRAN": "Transport occupations",
    "AGRI": "Agriculture and agri-food occupations",
}

export default {formatDate, classFilterMap}