import fs from 'fs';
import path from 'path';
import { dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const admin_id = process.env.ADMIN_USER_ID;

function logUserInteraction(bot, msg) {
    const dateTime = new Date();
    const chatId = msg.chat.id;
    const userId = msg.from.id;
    const userName = msg.from.username || `${msg.from.first_name} ${msg.from.last_name}`;
    const messageText = msg.text;

    console.log(`User Interaction - Chat ID: ${chatId}, User ID: ${userId}, Username: ${userName}, Message: ${messageText}`);

    // save log as json
    const log = {
        dateTime,
        chatId,
        userId,
        userName,
        messageText
    }

    // Send log to admin
    // sendLogToPrimary(bot, log);
    // Save logs to a file

}

function parseLogToString(bot, msg) {
    const dateTime = new Date();
    const chatId = msg.chat.id;
    const userId = msg.from.id;
    const userName = msg.from.username || `${msg.from.first_name} ${msg.from.last_name}`;
    const messageText = msg.text;

    return (`User Interaction - Date: ${dateTime} Chat ID: ${chatId}, User ID: ${userId}, Username: ${userName}, Message: ${messageText}`);

}

function saveLogToFile(log) {
    // Save logs to a file
    const dateToday = new Date().toISOString().split('T')[0];

    let logFilePath = path.join(__dirname, `user_interaction_${dateToday}.log`)
    const logString = JSON.stringify(log) + '\n'; // NDJSON format


    fs.appendFile(logFilePath, logString, (err) => {
        if (err) {
            console.error('Error saving log to file:', err);
        } else {
            console.log('Log saved to file:', logFilePath);
        }
    });
}

function sendLogToPrimary(bot, adminId = admin_id, log) {

    // Send log to primary user
    const primaryChatId = adminId;
    if (primaryChatId) {
        bot.sendMessage(primaryChatId, JSON.stringify(log, null, 2));
    }

}

const testLogSaveFile = () => {
    const log = {
        dateTime: new Date(),
        chatId: 123456,
        userId: 123,
        userName: 'testuser',
        messageText: 'test message'
    }
    saveLogToFile(log);
}

export default {logUserInteraction, sendLogToPrimary, parseLogToString}