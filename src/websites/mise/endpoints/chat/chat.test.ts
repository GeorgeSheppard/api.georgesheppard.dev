import { describe, it, expect, vi, beforeEach } from 'vitest';
import { chat, ChatRequest } from './chat.js';
import { createMockContext } from '@test/utils/mock-context.js';
import type { ContextWithUserId } from '@core/types/context.js';
import type { ChatMessage } from '../../schemas.js';

vi.mock('../../utils/chat-agent.js');
import { runChatAgent } from '../../utils/chat-agent.js';

const validUserId = '550e8400-e29b-41d4-a716-446655440000';

function mockContext() {
  const openaiClient = { getClient: vi.fn(() => 'openai-client-stub') };
  return createMockContext<ContextWithUserId>({
    userId: validUserId,
    dynamoClient: { client: {} },
    openaiClient,
  });
}

describe('chat handler', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns the assistant message produced by the chat agent', async () => {
    const assistantMessage: ChatMessage = {
      role: 'assistant',
      content: [{ type: 'text', text: 'Here is a recipe idea.' }],
    };
    vi.mocked(runChatAgent).mockResolvedValue(assistantMessage);

    const request: ChatRequest = {
      messages: [{ role: 'user', content: [{ type: 'text', text: 'Find me a curry recipe' }] }],
    };

    const result = await chat(mockContext(), request);

    expect(result).toEqual({ message: assistantMessage });
  });

  it('passes the conversation history and openai client through to the agent', async () => {
    vi.mocked(runChatAgent).mockResolvedValue({
      role: 'assistant',
      content: [{ type: 'text', text: 'ok' }],
    });
    const c = mockContext();
    const request: ChatRequest = {
      messages: [{ role: 'user', content: [{ type: 'text', text: 'hi' }] }],
    };

    await chat(c, request);

    expect(runChatAgent).toHaveBeenCalledWith(c, 'openai-client-stub', request.messages);
  });

  it('propagates errors from the chat agent', async () => {
    vi.mocked(runChatAgent).mockRejectedValue(new Error('OpenAI API error'));

    const request: ChatRequest = {
      messages: [{ role: 'user', content: [{ type: 'text', text: 'hi' }] }],
    };

    await expect(chat(mockContext(), request)).rejects.toThrow('OpenAI API error');
  });
});
