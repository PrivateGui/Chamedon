const TelegramBot = require('node-telegram-bot-api');
const ytdl = require('ytdl-core');
const fs = require('fs');
const path = require('path');

// Replace with your Telegram Bot token
const token = '7151280338:AAGf5-CPmnhvmFEaRFEPuRP1PD3qY79fsOY';
const bot = new TelegramBot(token, { polling: true });

// Create downloads directory if it doesn't exist
const downloadDir = path.join(__dirname, 'downloads');
if (!fs.existsSync(downloadDir)) {
    fs.mkdirSync(downloadDir);
}

// Start command
bot.onText(/\/start/, (msg) => {
    const chatId = msg.chat.id;
    const keyboard = {
        inline_keyboard: [
            [{ text: '📖 Help', callback_data: 'help' }],
            [{ text: '⚙️ Download Options', callback_data: 'options' }]
        ]
    };
    
    bot.sendMessage(chatId, 
        'Welcome! 🎉\nSend me a YouTube video link to download it.\nOr use /help to see available commands.',
        { reply_markup: keyboard }
    );
});

// Help command
bot.onText(/\/help/, (msg) => {
    const chatId = msg.chat.id;
    bot.sendMessage(chatId,
        '📚 Available Commands:\n\n' +
        '/start - Start the bot\n' +
        '/help - Show this help message\n' +
        '\nOr just send a YouTube link to download!'
    );
});

// Handle callback queries
bot.on('callback_query', async (query) => {
    const chatId = query.message.chat.id;
    
    if (query.data === 'help') {
        bot.sendMessage(chatId,
            '📚 Available Commands:\n\n' +
            '/start - Start the bot\n' +
            '/help - Show this help message\n' +
            '\nOr just send a YouTube link to download!'
        );
    }
    
    bot.answerCallbackQuery(query.id);
});

// Handle YouTube links
bot.on('message', async (msg) => {
    const chatId = msg.chat.id;
    const text = msg.text;

    // Check if message is a command
    if (text && text.startsWith('/')) return;

    // Check if message contains a YouTube URL
    if (text && (text.includes('youtube.com/') || text.includes('youtu.be/'))) {
        try {
            // Get video info
            const info = await ytdl.getInfo(text);
            const title = info.videoDetails.title;
            
            // Send processing message
            const statusMessage = await bot.sendMessage(chatId, '⏳ Processing video...');
            
            // Create unique filename
            const filename = path.join(downloadDir, `${Date.now()}.mp4`);
            
            // Download video
            const videoStream = ytdl(text, { quality: 'highest' });
            const fileStream = fs.createWriteStream(filename);
            
            videoStream.pipe(fileStream);
            
            fileStream.on('finish', async () => {
                try {
                    // Update status
                    await bot.editMessageText('📤 Uploading to Telegram...', {
                        chat_id: chatId,
                        message_id: statusMessage.message_id
                    });
                    
                    // Send video
                    await bot.sendVideo(chatId, filename, {
                        caption: `🎥 ${title}`
                    });
                    
                    // Cleanup
                    fs.unlinkSync(filename);
                    await bot.deleteMessage(chatId, statusMessage.message_id);
                    
                } catch (error) {
                    console.error('Error sending video:', error);
                    bot.sendMessage(chatId, '❌ Error sending video. Please try again.');
                }
            });
            
            fileStream.on('error', (error) => {
                console.error('File stream error:', error);
                bot.sendMessage(chatId, '❌ Error downloading video. Please try again.');
                if (fs.existsSync(filename)) {
                    fs.unlinkSync(filename);
                }
            });
            
        } catch (error) {
            console.error('Error processing video:', error);
            bot.sendMessage(chatId, '❌ Error processing video. Please check the link and try again.');
        }
    }
});

// Error handling
bot.on('polling_error', (error) => {
    console.error('Polling error:', error);
});

process.on('uncaughtException', (error) => {
    console.error('Uncaught exception:', error);
});

console.log('Bot is running...');
