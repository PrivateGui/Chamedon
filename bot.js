const TelegramBot = require('node-telegram-bot-api');
const ytdl = require('ytdl-core');
const ffmpegPath = require('ffmpeg-static');
const { exec } = require('child_process');

// Replace with your Telegram Bot token
const token = '7151280338:AAGf5-CPmnhvmFEaRFEPuRP1PD3qY79fsOY';
const bot = new TelegramBot(token, { polling: true });

bot.onText(/\/start/, (msg) => {
  const chatId = msg.chat.id;
  bot.sendMessage(chatId, 'Send me a YouTube video link, and I will download it for you!');
});

bot.onText(/https:\/\/www\.youtube\.com\/watch\?v=([a-zA-Z0-9_-]+)/, async (msg, match) => {
  const chatId = msg.chat.id;
  const videoUrl = match[0];
  
  try {
    // Download video from YouTube
    const videoStream = ytdl(videoUrl, { quality: 'highestvideo' });

    bot.sendMessage(chatId, 'Downloading video...');

    // Pipe the video to Telegram
    videoStream.pipe(bot.sendVideo(chatId, videoStream, { caption: 'Here is your video!' }));
  } catch (error) {
    bot.sendMessage(chatId, 'Sorry, there was an error while downloading the video.');
    console.error(error);
  }
});
