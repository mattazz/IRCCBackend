function logUserInteraction(msg){
    const chatId = msg.chat.id;
    const userId = msg.from.id;
    const userName = msg.from.username || `${msg.from.first_name} ${msg.from.last_name}`;
    const messageText = msg.text;

    console.log(`User Interaction - Chat ID: ${chatId}, User ID: ${userId}, Username: ${userName}, Message: ${messageText}`);

}

module.exports={
    logUserInteraction
}