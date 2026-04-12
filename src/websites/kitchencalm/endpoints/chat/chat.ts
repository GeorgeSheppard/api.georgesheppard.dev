import { z } from 'zod';
import { ContextWithUserId } from '@core/types/context.js';
import { callOpenAIChat } from '../../utils/openai-chat.js';
import { config } from '@config/index.js';

export const ChatMessageSchema = z.object({
  role: z.enum(['user', 'assistant']),
  content: z.string().min(1),
});

export type ChatMessage = z.infer<typeof ChatMessageSchema>;

export const ChatRequestSchema = z.object({
  messages: z.array(ChatMessageSchema).min(1),
});

export type ChatRequest = z.infer<typeof ChatRequestSchema>;

export const ChatResponseSchema = z.object({
  message: z.string(),
});

export type ChatResponse = z.infer<typeof ChatResponseSchema>;

export async function chat(c: ContextWithUserId, input: ChatRequest): Promise<ChatResponse> {
  const message = await callOpenAIChat(config.OPENAI_API_KEY, input.messages, c);
  return { message };
}
