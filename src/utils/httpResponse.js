/**
 * Sends a standard JSON error response so every /api/* route responds consistently.
 */
function sendJsonError(res, status, message) {
    res.status(status).json({ error: message });
}

export default { sendJsonError };
