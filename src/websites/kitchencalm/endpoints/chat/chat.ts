import { z } from 'zod';
import { ContextWithUserId } from '@core/types/context.js';
import { getOpenAIKeyForUser } from '@core/dynamodb/utilities.js';
import { callOpenAIChat } from '../../utils/openai-chat.js';

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

export type ChatResult =
  | { status: 200; body: ChatResponse }
  | { status: 400; body: { error: string } };

export async function chat(c: ContextWithUserId, input: ChatRequest): Promise<ChatResult> {
  const userId = c.get('userId');
  const dynamoClient = c.get('dynamoClient');

  const apiKey = await getOpenAIKeyForUser(dynamoClient.client, userId);
  if (!apiKey) {
    return {
      status: 400,
      body: { error: 'No OpenAI API key configured. Please add your API key first.' },
    };
  }

  const message = await callOpenAIChat(apiKey, input.messages);

  return { status: 200, body: { message } };
}
