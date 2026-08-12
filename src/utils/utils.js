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

/**
 * Distinct, stable keyword per class used to match a draw's raw `class`/`subclass` text
 * (case-insensitive), separate from classFilterMap's full display names. IRCC has changed
 * the wording/casing/punctuation of these names over time (e.g. "French language
 * proficiency (Version 1)" -> "French-Language proficiency 2026-Version 2", "Healthcare
 * occupations" -> "Healthcare and Social Services Occupations, 2026-Version 3") - a short,
 * distinctive root word survives that kind of drift instead of breaking on it.
 */
const classMatchKeywords = {
    "CEC": "Canadian Experience Class",
    "FSW": "Federal Skilled Worker",
    "FST": "Federal Skilled Trades",
    "PNP": "Provincial Nominee Program",
    "FLP": "French",
    "TO": "Trade",
    "HO": "Healthcare",
    "STEM": "STEM",
    "GEN": "General",
    "TRAN": "Transport",
    "AGRI": "Agriculture",
}

export default {formatDate, classFilterMap, classMatchKeywords}