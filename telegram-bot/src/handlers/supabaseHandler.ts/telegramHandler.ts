import { Context } from 'telegraf';
import axios from 'axios';
import { generateClaudeResponse } from './claudeHandler';
import { saveCandidateResume, createOrUpdateCandidate, logActivity } from './supabaseHandler';

interface ConversationMemory {
    addMessage: (userId: number, role: 'user' | 'assistant', content: string) => void;
    getHistory: (userId: number) => any[];
}

export async function handleMessage(ctx: Context, conversationMemory: ConversationMemory): Promise<void> {
    try {
          const userId = ctx.from?.id;
          const firstName = ctx.from?.first_name || 'User';
          const username = ctx.from?.username;

      if (!userId) {
              await ctx.reply('Unable to identify user.');
              return;
      }

      // Handle text messages
      if (ctx.message && 'text' in ctx.message) {
              const userMessage = ctx.message.text;
              conversationMemory.addMessage(userId, 'user', userMessage);
              await ctx.sendChatAction('typing');

            const history = conversationMemory.getHistory(userId);
              const assistantResponse = await generateClaudeResponse(userMessage, history);
              conversationMemory.addMessage(userId, 'assistant', assistantResponse);

            await createOrUpdateCandidate({
                      full_name: firstName,
                      telegram_user_id: userId,
                      telegram_username: username,
                      source: 'telegram',
                      current_status: 'telegram_engaged',
                      conversation_history: history,
            });

            await ctx.reply(assistantResponse);
      }

      // Handle file uploads (resume)
      if (ctx.message && 'document' in ctx.message) {
              const document = ctx.message.document;
              if (!document.mime_type?.includes('pdf')) {
                        await ctx.reply('📄 Please send a PDF file for your resume.');
                        return;
              }

            await ctx.sendChatAction('typing');
              const fileLink = await ctx.telegram.getFileLink(document.file_id);
              const fileResponse = await axios.get(fileLink.href, { responseType: 'arraybuffer' });
              const fileBuffer = Buffer.from(fileResponse.data);

            const resumeUrl = await saveCandidateResume(fileBuffer, document.file_name || 'resume.pdf', userId);
              const candidate = await createOrUpdateCandidate({
                        full_name: firstName,
                        telegram_user_id: userId,
                        telegram_username: username,
                        source: 'telegram',
                        resume_url: resumeUrl,
                        current_status: 'resume_received',
                        conversation_history: conversationMemory.getHistory(userId),
              });

            await logActivity(candidate.id, 'resume_uploaded', 'Resume uploaded via Telegram', { resume_url: resumeUrl });
              await ctx.reply('✅ Great! I\'ve received your resume. Tell me about your experience.');

            const followUp = await generateClaudeResponse(
                      `Candidate ${firstName} uploaded their resume. Ask a relevant follow-up question.`,
                      conversationMemory.getHistory(userId)
                    );
              await ctx.reply(followUp);
              conversationMemory.addMessage(userId, 'assistant', followUp);
      }
    } catch (error) {
          console.error('Error handling message:', error);
          await ctx.reply('Sorry, there was an error. Please try again.');
    }
}
