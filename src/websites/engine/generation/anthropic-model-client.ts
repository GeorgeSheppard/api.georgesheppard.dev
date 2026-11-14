import Anthropic from '@anthropic-ai/sdk';
import type { ModelClient, ModelMessage } from './types.js';

interface StreamingMessages {
  stream(params: Record<string, unknown>): { finalMessage(): Promise<ModelMessage> };
}

export function createAnthropicModelClient(apiKey: string): ModelClient {
  const messages = new Anthropic({ apiKey }).beta.messages as unknown as StreamingMessages;
  return {
    createMessage: ({ model, system, tools, messages: conversation }) =>
      messages
        .stream({
          model,
          max_tokens: 32000,
          system,
          tools,
          messages: conversation,
          thinking: { type: 'adaptive' },
          output_config: { effort: 'medium' },
          betas: ['server-side-fallback-2026-07-01'],
          fallbacks: 'default',
        })
        .finalMessage(),
  };
}
