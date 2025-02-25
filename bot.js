const TelegramBot = require('node-telegram-bot-api');
const path = require('path');
const fs = require('fs');

// Replace with your actual Telegram bot token
const token = '7576728027:AAGP3fgpHckgrG-MeJZNQGO8Z7xuj_b0fRs';

// Create a bot instance
const bot = new TelegramBot(token, { polling: true });

// Path to the directory where your files are stored
const fileDir = path.join(__dirname, 'files');

// Path to JSON files for tracking
const statsFilePath = path.join(__dirname, 'fileStats.json');
const likesFilePath = path.join(__dirname, 'fileLikes.json');

// Initialize or load tracking data
let fileStats = {};
let fileLikes = {};

// Load existing stats if available
try {
  if (fs.existsSync(statsFilePath)) {
    fileStats = JSON.parse(fs.readFileSync(statsFilePath, 'utf8'));
  } else {
    fs.writeFileSync(statsFilePath, JSON.stringify(fileStats), 'utf8');
    console.log('📊 Created new stats file');
  }

  if (fs.existsSync(likesFilePath)) {
    fileLikes = JSON.parse(fs.readFileSync(likesFilePath, 'utf8'));
  } else {
    fs.writeFileSync(likesFilePath, JSON.stringify(fileLikes), 'utf8');
    console.log('👍 Created new likes file');
  }
} catch (error) {
  console.error('Error initializing stats files:', error);
}

// Function to save stats to JSON
const saveStats = () => {
  fs.writeFileSync(statsFilePath, JSON.stringify(fileStats, null, 2), 'utf8');
};

// Function to save likes to JSON
const saveLikes = () => {
  fs.writeFileSync(likesFilePath, JSON.stringify(fileLikes, null, 2), 'utf8');
};

// Handle /start command without parameters (greeting)
bot.onText(/^\/start$/, (msg) => {
  const chatId = msg.chat.id;
  const user = msg.from.first_name;
  
  bot.sendMessage(chatId, `سلام ${user} عزیز! 👋\n\nبه ربات ما خوش آمدید.\nبرای دریافت فایل، لطفا دستور زیر را وارد کنید:\n/start نام_فایل\n\n📁 فایل‌های خود را بدون پسوند وارد کنید.`);
});

// Function to send the file based on user input (e.g., /start <anyfilename>)
bot.onText(/\/start\s+(.+)/i, (msg, match) => {
  const chatId = msg.chat.id;
  const requestedFile = match[1].toLowerCase().trim(); // Get the user input, case-insensitive

  // Scan the 'files' folder for any file that matches the requestedFile (case-insensitive)
  fs.readdir(fileDir, (err, files) => {
    if (err) {
      console.error('Error reading files directory:', err);
      bot.sendMessage(chatId, '❌ متأسفانه در دسترسی به فایل‌ها مشکلی پیش آمده است. لطفا بعدا تلاش کنید.');
      return;
    }

    // Filter the files by checking if their name matches the user input (case-insensitive)
    const matchingFiles = files.filter(file => file.toLowerCase().startsWith(requestedFile));

    if (matchingFiles.length > 0) {
      // Send the matching file(s)
      matchingFiles.forEach(file => {
        const filePath = path.join(fileDir, file);
        
        // Update download count
        if (!fileStats[file]) {
          fileStats[file] = { downloads: 0 };
        }
        fileStats[file].downloads += 1;
        saveStats();
        
        // Initialize likes if not exist
        if (!fileLikes[file]) {
          fileLikes[file] = { total: 0, users: [] };
          saveLikes();
        }
        
        const downloadCount = fileStats[file].downloads;
        const likeCount = fileLikes[file].total;
        
        // Create inline keyboard
        const keyboard = {
          inline_keyboard: [
            [
              { 
                text: `👍 پسندیدم (${likeCount})`, 
                callback_data: `like_${file}` 
              }
            ],
            [
              { 
                text: `📥 تعداد دانلود: ${downloadCount}`, 
                callback_data: 'download_info' 
              }
            ]
          ]
        };
        
        bot.sendDocument(chatId, filePath, {
          caption: `📄 ${file}\n\n📊 این فایل ${downloadCount} بار دانلود شده است.\n❤️ تعداد لایک‌ها: ${likeCount}`,
          reply_markup: keyboard
        })
          .then(() => {
            console.log(`Sent file: ${file} (Downloads: ${downloadCount})`);
          })
          .catch((error) => {
            console.error('Error sending file:', error);
            bot.sendMessage(chatId, '❌ متأسفانه در ارسال فایل مشکلی پیش آمده است. لطفا بعدا تلاش کنید.');
          });
      });
    } else {
      // If no matching file is found
      bot.sendMessage(chatId, '❌ فایل مورد نظر شما پیدا نشد. لطفا نام فایل را بررسی کنید.');
    }
  });
});

// Handle callback queries (like button)
bot.on('callback_query', (query) => {
  const userId = query.from.id;
  const messageId = query.message.message_id;
  const chatId = query.message.chat.id;
  
  if (query.data.startsWith('like_')) {
    const file = query.data.replace('like_', '');
    
    // Check if user already liked this file
    if (!fileLikes[file].users.includes(userId)) {
      // Add user to liked list and increase count
      fileLikes[file].users.push(userId);
      fileLikes[file].total += 1;
      saveLikes();
      
      // Update the message with new like count
      const downloadCount = fileStats[file].downloads;
      const likeCount = fileLikes[file].total;
      
      const keyboard = {
        inline_keyboard: [
          [
            { 
              text: `👍 پسندیدم (${likeCount})`, 
              callback_data: `like_${file}` 
            }
          ],
          [
            { 
              text: `📥 تعداد دانلود: ${downloadCount}`, 
              callback_data: 'download_info' 
            }
          ]
        ]
      };
      
      bot.editMessageCaption(`📄 ${file}\n\n📊 این فایل ${downloadCount} بار دانلود شده است.\n❤️ تعداد لایک‌ها: ${likeCount}`, {
        chat_id: chatId,
        message_id: messageId,
        reply_markup: keyboard
      });
      
      // Notify user
      bot.answerCallbackQuery(query.id, {
        text: '❤️ با تشکر از لایک شما!',
        show_alert: false
      });
    } else {
      // User already liked
      bot.answerCallbackQuery(query.id, {
        text: '⚠️ شما قبلاً این فایل را لایک کرده‌اید.',
        show_alert: true
      });
    }
  } else if (query.data === 'download_info') {
    bot.answerCallbackQuery(query.id, {
      text: '📊 این آمار نشان‌دهنده تعداد دفعاتی است که این فایل دانلود شده است.',
      show_alert: true
    });
  }
});

// Start the bot
console.log('🎉 ربات در حال اجرا است...');
