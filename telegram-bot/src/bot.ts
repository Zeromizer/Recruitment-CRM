import { Telegraf } from 'telegraf';
import { message } from 'telegraf/filters';
import * as dotenv from 'dotenv';
import { handleMessage } from './telegramHandler';
import { setupConversationMemory } from './utils/conversationMemory';

dotenv.config();

const TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const PORT = parseInt(process.env.BOT_PORT || '3000', 10);

if (!TOKEN) {
    throw new Error('TELEGRAM_BOT_TOKEN is not defined');
}

const bot = new Telegraf(TOKEN);

// Initialize conversation memory
const conversationMemory = setupConversationMemory();

// Handle start command
bot.command('start', (ctx) => {
    ctx.reply(
          '👋 Welcome to Recruiter CRM Bot!\n\n' +
          'I\'m here to help you with your job application. ' +
          'Simply share your resume and I\'ll guide you through the process.\n\n' +
          '/help - Get more information'
        );
});

// Handle help command
bot.command('help', (ctx) => {
    ctx.reply(
          '📋 How to use this bot:\n\n' +
          '1. Send me your resume (PDF, Word, or image)\n' +
          '2. Tell me about your experience\n' +
          '3. I\'ll ask you some questions to understand your profile better\n\n' +
          'Commands:\n' +
          '/start - Start the conversation\n' +
          '/help - Show this message'
        );
});

// Handle all messages and files
bot.on(message('text'), async (ctx) => {
    try {
          await handleMessage(ctx, conversationMemory);
    } catch (error) {
          console.error('Error handling message:', error);
          ctx.reply('Sorry, there was an error processing your message. Please try again.');
    }
});

// Handle file uploads (documents, photos)
bot.on(['document', 'photo'], async (ctx) => {
    try {
          await handleMessage(ctx, conversationMemory);
    } catch (error) {
          console.error('Error handling file:', error);
          ctx.reply('Sorry, there was an error processing your file. Please try again.');
    }
});

// Error handler
bot.catch((err, ctx) => {
    console.error('Telegraf error:', err);
    ctx.reply('An error occurred. Please try again later.');
});

// Start bot
if (process.env.BOT_MODE === 'webhook') {
    // Webhook mode for production (Railway)
  bot.launch({
        webhook: {
                domain: process.env.BOT_DOMAIN || 'localhost',
                port: PORT,
        },
  });
    console.log(`🤖 Bot started in webhook mode on port ${PORT}`);
} else {
    // Polling mode for development
  bot.launch();
    console.log('🤖 Bot started in polling mode');
}

// Graceful shutdown
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));

export default bot;
