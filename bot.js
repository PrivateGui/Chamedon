const TelegramBot = require('node-telegram-bot-api');
const ytdl = require('ytdl-core');
const ffmpeg = require('fluent-ffmpeg');
const fs = require('fs');
const path = require('path');
const os = require('os');

// Replace with your Telegram Bot token
const token = '7151280338:AAGf5-CPmnhvmFEaRFEPuRP1PD3qY79fsOY';
const bot = new TelegramBot(token, { polling: true });

// Create temporary directory for downloads
const tempDir = path.join(os.tmpdir(), 'telegram-youtube-bot');
if (!fs.existsSync(tempDir)) {
    fs.mkdirSync(tempDir);
}

// Helper function to format bytes
function formatBytes(bytes) {
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    if (bytes === 0) return '0 Byte';
    const i = parseInt(Math.floor(Math.log(bytes) / Math.log(1024)));
    return Math.round(100 * (bytes / Math.pow(1024, i))) / 100 + ' ' + sizes[i];
}

// Command handlers
const commands = {
    start: (msg) => {
        const chatId = msg.chat.id;
        const keyboard = {
            inline_keyboard: [
                [
                    { text: '📖 Help', callback_data: 'help' },
                    { text: '⚙️ Settings', callback_data: 'settings' }
                ]
            ]
        };
        
        bot.sendMessage(chatId, 
            'Welcome to YouTube Downloader Bot! 🎉\n\n' +
            'Send me a YouTube video link, and I will download it for you!\n' +
            'Use /help to see all available commands.',
            { reply_markup: keyboard }
        );
    },

    help: (msg) => {
        const chatId = msg.chat.id;
        bot.sendMessage(chatId,
            '📚 Available Commands:\n\n' +
            '/start - Start the bot\n' +
            '/help - Show this help message\n' +
            '/settings - Configure download preferences\n' +
            '/info <video_url> - Get video information\n' +
            '/audio <video_url> - Download as audio only\n\n' +
            'Or simply send a YouTube URL to download the video!'
        );
    },

    settings: (msg) => {
        const chatId = msg.chat.id;
        const keyboard = {
            inline_keyboard: [
                [
                    { text: '🎥 Video Quality', callback_data: 'quality' },
                    { text: '🔊 Audio Quality', callback_data: 'audio_quality' }
                ],
                [
                    { text: '📁 Format', callback_data: 'format' },
                    { text: '⬇️ Download Type', callback_data: 'download_type' }
                ]
            ]
        };
        
        bot.sendMessage(chatId, 'Choose a setting to modify:', { reply_markup: keyboard });
    }
};

// Register command handlers
Object.entries(commands).forEach(([command, handler]) => {
    bot.onText(new RegExp(`^/${command}`), handler);
});

// Handle callback queries from inline keyboards
bot.on('callback_query', async (query) => {
    const chatId = query.message.chat.id;
    
    switch (query.data) {
        case 'help':
            commands.help({ chat: { id: chatId }});
            break;
        case 'settings':
            commands.settings({ chat: { id: chatId }});
            break;
        case 'quality':
            const qualityKeyboard = {
                inline_keyboard: [
                    [
                        { text: '1080p', callback_data: 'quality_1080' },
                        { text: '720p', callback_data: 'quality_720' },
                        { text: '480p', callback_data: 'quality_480' }
                    ]
                ]
            };
            bot.sendMessage(chatId, 'Select video quality:', { reply_markup: qualityKeyboard });
            break;
        // Add more callback handlers as needed
    }
    
    bot.answerCallbackQuery(query.id);
});

// Handle YouTube links
bot.onText(/(?:https?:\/\/)?(?:www\.)?(?:youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]+)/, async (msg, match) => {
    const chatId = msg.chat.id;
    const videoId = match[1];
    const videoUrl = `https://www.youtube.com/watch?v=${videoId}`;
    
    try {
        // Get video information
        const info = await ytdl.getInfo(videoUrl);
        const title = info.videoDetails.title;
        
        // Send video information with download options
        const keyboard = {
            inline_keyboard: [
                [
                    { text: '🎥 Download Video', callback_data: `download_video_${videoId}` },
                    { text: '🎵 Download Audio', callback_data: `download_audio_${videoId}` }
                ],
                [
                    { text: '📊 Video Info', callback_data: `info_${videoId}` }
                ]
            ]
        };
        
        bot.sendMessage(chatId,
            `📝 Title: ${title}\n` +
            `👁 Views: ${info.videoDetails.viewCount}\n` +
            `⏱ Duration: ${Math.floor(info.videoDetails.lengthSeconds / 60)}:${(info.videoDetails.lengthSeconds % 60).toString().padStart(2, '0')}\n\n` +
            'Choose download option:',
            { reply_markup: keyboard }
        );
        
    } catch (error) {
        bot.sendMessage(chatId, '❌ Sorry, there was an error processing the video.\n\nPlease check if the video is available and try again.');
        console.error(error);
    }
});

// Function to download and send video
async function downloadAndSendVideo(chatId, videoUrl, format = 'mp4') {
    try {
        const info = await ytdl.getInfo(videoUrl);
        const title = info.videoDetails.title;
        const fileName = path.join(tempDir, `${Date.now()}.${format}`);
        
        // Send progress message
        const progressMsg = await bot.sendMessage(chatId, '⏳ Starting download...');
        
        // Download video
        const videoStream = ytdl(videoUrl, { quality: 'highest' });
        const writeStream = fs.createWriteStream(fileName);
        
        videoStream.pipe(writeStream);
        
        writeStream.on('finish', async () => {
            try {
                // Update progress
                await bot.editMessageText('📤 Uploading to Telegram...', {
                    chat_id: chatId,
                    message_id: progressMsg.message_id
                });
                
                // Send video file
                await bot.sendVideo(chatId, fileName, {
                    caption: `🎥 ${title}`
                });
                
                // Clean up
                fs.unlinkSync(fileName);
                await bot.deleteMessage(chatId, progressMsg.message_id);
                
            } catch (error) {
                console.error('Error sending video:', error);
                bot.sendMessage(chatId, '❌ Error sending video to Telegram.');
            }
        });
        
    } catch (error) {
        console.error('Error downloading video:', error);
        bot.sendMessage(chatId, '❌ Error downloading video.');
    }
}

// Error handling
bot.on('polling_error', (error) => {
    console.error('Polling error:', error);
});

process.on('uncaughtException', (error) => {
    console.error('Uncaught exception:', error);
});

console.log('Bot is running...');
