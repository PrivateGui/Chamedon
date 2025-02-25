const TelegramBot = require('node-telegram-bot-api');
const path = require('path');
const fs = require('fs');

// Replace with your actual Telegram bot token
const token = '7576728027:AAGP3fgpHckgrG-MeJZNQGO8Z7xuj_b0fRs';

// Create a bot instance
const bot = new TelegramBot(token, { polling: true });

// Path to the directory where your files are stored
const fileDir = path.join(__dirname, 'files'); // Changed from 'images' to 'files'

// Function to send the file based on user input (e.g., /start <anyfilename>)
bot.onText(/\/start\s+(.+)/i, (msg, match) => {  // Changed from '/file' to '/start'
  const chatId = msg.chat.id;
  const requestedFile = match[1].toLowerCase().trim(); // Get the user input, case-insensitive

  // Scan the 'files' folder for any file that matches the requestedFile (case-insensitive)
  fs.readdir(fileDir, (err, files) => {
    if (err) {
      console.error('Error reading files directory:', err);
      return;
    }

    // Filter the files by checking if their name matches the user input (case-insensitive)
    const matchingFiles = files.filter(file => file.toLowerCase().startsWith(requestedFile));

    if (matchingFiles.length > 0) {
      // Send the matching file(s)
      matchingFiles.forEach(file => {
        const filePath = path.join(fileDir, file);
        bot.sendDocument(chatId, filePath)
          .then(() => {
            console.log(`Sent file: ${file}`);
          })
          .catch((error) => {
            console.error('Error sending file:', error);
          });
      });
    }
    // If no matching file is found, do nothing (no response sent)
  });
});

// Start the bot
console.log('🎉 Bot is running...');
