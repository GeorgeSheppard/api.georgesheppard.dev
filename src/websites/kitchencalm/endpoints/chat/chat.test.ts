import { describe, it, expect, vi, beforeEach } from 'vitest';
import { chat } from './chat.js';
import { createMockContext } from '@test/utils/mock-context.js';
import type { ContextWithUserId } from '@core/types/context.js';

vi.mock('../../queries/chat-api-keys.js');
vi.mock('../../utils/openai-chat.js');
import { getChatApiKey } from '../../queries/chat-api-keys.js';
import { callOpenAIChat } from '../../utils/openai-chat.js';

const validUserId = '550e8400-e29b-41d4-a716-446655440000';

function mockContext(userId = validUserId) {
  return createMockContext<ContextWithUserId>({
    userId,
    databaseClient: { db: {} },
  });
}

describe('chat handler', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return 400 when no API key is stored', async () => {
    vi.mocked(getChatApiKey).mockResolvedValue(null);

    const result = await chat(mockContext(), { messages: [{ role: 'user', content: 'Hello' }] });

    expect(result).toEqual({
      status: 400,
      body: { error: 'No OpenAI API key configured. Please add your API key first.' },
    });
    expect(callOpenAIChat).not.toHaveBeenCalled();
  });

  it('should return 200 with the AI response message', async () => {
    vi.mocked(getChatApiKey).mockResolvedValue('sk-test-key');
    vi.mocked(callOpenAIChat).mockResolvedValue('Here is a great pasta recipe...');

    const result = await chat(mockContext(), {
      messages: [{ role: 'user', content: 'Find me a pasta recipe' }],
    });

    expect(result).toEqual({ status: 200, body: { message: 'Here is a great pasta recipe...' } });
  });

  it('should pass apiKey, messages, and context to callOpenAIChat', async () => {
    vi.mocked(getChatApiKey).mockResolvedValue('sk-test-key');
    vi.mocked(callOpenAIChat).mockResolvedValue('Sure!');

    const messages = [{ role: 'user' as const, content: 'What can I make with chicken?' }];
    const c = mockContext();

    await chat(c, { messages });

    expect(callOpenAIChat).toHaveBeenCalledWith('sk-test-key', messages, c);
  });

  it('should throw when OpenAI call fails', async () => {
    vi.mocked(getChatApiKey).mockResolvedValue('sk-test-key');
    vi.mocked(callOpenAIChat).mockRejectedValue(new Error('OpenAI API error'));

    await expect(
      chat(mockContext(), { messages: [{ role: 'user', content: 'Hello' }] })
    ).rejects.toThrow('OpenAI API error');
  });
});
