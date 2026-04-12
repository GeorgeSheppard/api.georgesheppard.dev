import OpenAI from 'openai';
import { ChatMessage } from '../endpoints/chat/chat.js';

const SYSTEM_PROMPT =
  'You are a helpful cooking assistant for KitchenCalm. ' +
  'You help users discover recipes, plan meals, find cooking techniques, and answer food-related questions. ' +
  'When asked to find or suggest recipes, use the web search tool to provide current and varied results. ' +
  'Be practical and concise in your responses.';

export async function callOpenAIChat(apiKey: string, messages: ChatMessage[]): Promise<string> {
  const openai = new OpenAI({ apiKey });

  const response = await openai.responses.create({
    model: 'gpt-4o',
    instructions: SYSTEM_PROMPT,
    tools: [{ type: 'web_search_preview' }],
    input: messages,
  });

  return response.output_text;
}
