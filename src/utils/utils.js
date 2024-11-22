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

module.exports = {
    formatDate
}