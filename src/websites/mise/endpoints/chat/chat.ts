import { z } from 'zod';
import { ContextWithUserId } from '@core/types/context.js';
import { ChatMessageSchema } from '../../schemas.js';
import { runChatAgent } from '../../utils/chat-agent.js';

export const ChatRequestSchema = z.object({
  messages: z
    .array(ChatMessageSchema)
    .min(1)
    .describe('Full conversation history so far, including the latest user message'),
});

export type ChatRequest = z.infer<typeof ChatRequestSchema>;

export const ChatResponseSchema = z.object({
  message: ChatMessageSchema.describe('The assistant reply to append to the conversation'),
});

export type ChatResponse = z.infer<typeof ChatResponseSchema>;

export async function chat(c: ContextWithUserId, input: ChatRequest): Promise<ChatResponse> {
  const openaiClient = c.get('openaiClient');
  const message = await runChatAgent(c, openaiClient.getClient(), input.messages);
  return { message };
}
