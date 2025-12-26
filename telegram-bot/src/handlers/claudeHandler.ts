import Anthropic from '@anthropic-ai/sdk';
import { config } from '../config';

interface Message {
    role: 'user' | 'assistant';
    content: string;
}

const client = new Anthropic({
    apiKey: config.claude.apiKey,
});

const SYSTEM_PROMPT = `You are a professional recruiter assistant chatbot. Your goal is to:
1. Engage candidates in a friendly, professional manner
2. Collect their resume and relevant information
3. Ask about their experience, skills, and job preferences
4. Keep responses concise (1-2 sentences maximum)
5. Always be encouraging and positive

When a candidate shares a resume or discusses their experience, acknowledge it and ask follow-up questions to learn more about them.`;

export async function generateClaudeResponse(
    userMessage: string,
    conversationHistory: Message[]
  ): Promise<string> {
    try {
          const messages: Anthropic.Messages.MessageParam[] = [
                  ...conversationHistory.map((msg) => ({
                            role: msg.role as 'user' | 'assistant',
                            content: msg.content,
                  })),
            {
                      role: 'user' as const,
                      content: userMessage,
            },
                ];

      const response = await client.messages.create({
              model: config.claude.model,
              max_tokens: 150,
              system: SYSTEM_PROMPT,
              messages: messages,
      });

      const textContent = response.content.find((block) => block.type === 'text');
          if (!textContent || textContent.type !== 'text') {
                  throw new Error('No text content in Claude response');
          }

      return textContent.text;
    } catch (error) {
          console.error('Claude API error:', error);
          throw error;
    }
}
