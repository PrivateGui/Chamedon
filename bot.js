const TelegramBot = require('node-telegram-bot-api');
const { MongoClient } = require('mongodb');
const path = require('path');
const fs = require('fs');

// ✅ Replace with your actual Railway MongoDB connection string
const mongoURI = 'mongodb://mongo:teQHtQRjhxCWxcezNkfuoelsdetxOxdq@mainline.proxy.rlwy.net:13140';

// ✅ Create a MongoDB client
const client = new MongoClient(mongoURI, { useNewUrlParser: true, useUnifiedTopology: true });

// ✅ Connect to MongoDB
let db, statsCollection, likesCollection;
async function connectDB() {
  try {
    await client.connect();
    db = client.db('telegram_bot'); // Create database (if not exists)
    statsCollection = db.collection('fileStats'); // Collection for download stats
    likesCollection = db.collection('fileLikes'); // Collection for likes
    console.log('✅ Connected to MongoDB');
  } catch (error) {
    console.error('❌ MongoDB connection error:', error);
  }
}
connectDB();

// ✅ Replace with your actual Telegram bot token
const token = '7576728027:AAGP3fgpHckgrG-MeJZNQGO8Z7xuj_b0fRs';
const bot = new TelegramBot(token, { polling: true });

const fileDir = path.join(__dirname, 'files');

// ✅ Function to get file stats
async function getFileStats(filename) {
  const stats = await statsCollection.findOne({ file: filename });
  return stats ? stats.downloads : 0;
}

// ✅ Function to update file download count
async function incrementDownloadCount(filename) {
  await statsCollection.updateOne(
    { file: filename },
    { $inc: { downloads: 1 } },
    { upsert: true }
  );
}

// ✅ Function to get likes
async function getFileLikes(filename) {
  const likes = await likesCollection.findOne({ file: filename });
  return likes ? likes.total : 0;
}

// ✅ Function to add a like
async function addLike(filename, userId) {
  const file = await likesCollection.findOne({ file: filename });
  if (file && file.users.includes(userId)) return false; // Already liked

  await likesCollection.updateOne(
    { file: filename },
    {
      $addToSet: { users: userId },
      $inc: { total: 1 },
    },
    { upsert: true }
  );
  return true;
}

// ✅ Handle /start command (Greeting)
bot.onText(/^\/start$/, (msg) => {
  const chatId = msg.chat.id;
  const user = msg.from.first_name;
  bot.sendMessage(chatId, `سلام ${user} عزیز! 👋\n\nبه ربات ما خوش آمدید.`);
});

// ✅ Handle /start <filename>
bot.onText(/\/start\s+(.+)/i, async (msg, match) => {
  const chatId = msg.chat.id;
  const requestedFile = match[1].toLowerCase().trim();

  fs.readdir(fileDir, async (err, files) => {
    if (err) {
      console.error('Error reading files directory:', err);
      bot.sendMessage(chatId, '❌ مشکلی در دسترسی به فایل‌ها وجود دارد.');
      return;
    }

    const matchingFiles = files.filter(file => file.toLowerCase().startsWith(requestedFile));

    if (matchingFiles.length > 0) {
      for (const file of matchingFiles) {
        const filePath = path.join(fileDir, file);

        await incrementDownloadCount(file); // Update MongoDB
        const downloadCount = await getFileStats(file);
        const likeCount = await getFileLikes(file);

        const keyboard = {
          inline_keyboard: [
            [{ text: `👍 پسندیدم (${likeCount})`, callback_data: `like_${file}` }],
            [{ text: `📥 تعداد دانلود: ${downloadCount}`, callback_data: 'download_info' }]
          ]
        };

        bot.sendDocument(chatId, filePath, {
          caption: `📄 ${file}\n\n📊 این فایل ${downloadCount} بار دانلود شده است.\n❤️ تعداد لایک‌ها: ${likeCount}`,
          reply_markup: keyboard
        }).catch(error => {
          console.error('Error sending file:', error);
          bot.sendMessage(chatId, '❌ مشکلی در ارسال فایل وجود دارد.');
        });
      }
    } else {
      bot.sendMessage(chatId, '❌ فایل مورد نظر پیدا نشد.');
    }
  });
});

// ✅ Handle likes
bot.on('callback_query', async (query) => {
  const userId = query.from.id;
  const chatId = query.message.chat.id;
  const messageId = query.message.message_id;

  if (query.data.startsWith('like_')) {
    const file = query.data.replace('like_', '');
    const liked = await addLike(file, userId);

    if (liked) {
      const downloadCount = await getFileStats(file);
      const likeCount = await getFileLikes(file);

      const keyboard = {
        inline_keyboard: [
          [{ text: `👍 پسندیدم (${likeCount})`, callback_data: `like_${file}` }],
          [{ text: `📥 تعداد دانلود: ${downloadCount}`, callback_data: 'download_info' }]
        ]
      };

      bot.editMessageCaption(`📄 ${file}\n\n📊 این فایل ${downloadCount} بار دانلود شده است.\n❤️ تعداد لایک‌ها: ${likeCount}`, {
        chat_id: chatId,
        message_id: messageId,
        reply_markup: keyboard
      });

      bot.answerCallbackQuery(query.id, { text: '❤️ لایک شما ثبت شد!', show_alert: false });
    } else {
      bot.answerCallbackQuery(query.id, { text: '⚠️ شما قبلاً این فایل را لایک کرده‌اید.', show_alert: true });
    }
  } else if (query.data === 'download_info') {
    bot.answerCallbackQuery(query.id, { text: '📊 این آمار تعداد دفعات دانلود فایل است.', show_alert: true });
  }
});

// ✅ Start the bot
console.log('🎉 ربات در حال اجرا است...');
