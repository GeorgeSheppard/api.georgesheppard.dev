import { describe, it, expect, vi, beforeEach } from 'vitest';
import { chat } from './chat.js';
import { createMockContext } from '@test/utils/mock-context.js';
import type { ContextWithUserId } from '@core/types/context.js';

vi.mock('@core/dynamodb/utilities.js');
vi.mock('../../utils/openai-chat.js');
import { getOpenAIKeyForUser } from '@core/dynamodb/utilities.js';
import { callOpenAIChat } from '../../utils/openai-chat.js';

const validUserId = '550e8400-e29b-41d4-a716-446655440000';

function mockContext(userId = validUserId) {
  return createMockContext<ContextWithUserId>({
    userId,
    dynamoClient: { client: {} },
  });
}

describe('chat handler', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return 400 when no API key is stored', async () => {
    vi.mocked(getOpenAIKeyForUser).mockResolvedValue(null);

    const result = await chat(mockContext(), { messages: [{ role: 'user', content: 'Hello' }] });

    expect(result).toEqual({
      status: 400,
      body: { error: 'No OpenAI API key configured. Please add your API key first.' },
    });
    expect(callOpenAIChat).not.toHaveBeenCalled();
  });

  it('should return 200 with the AI response message', async () => {
    vi.mocked(getOpenAIKeyForUser).mockResolvedValue('sk-test-key');
    vi.mocked(callOpenAIChat).mockResolvedValue('Here is a great pasta recipe...');

    const result = await chat(mockContext(), {
      messages: [{ role: 'user', content: 'Find me a pasta recipe' }],
    });

    expect(result).toEqual({ status: 200, body: { message: 'Here is a great pasta recipe...' } });
  });

  it('should pass apiKey and messages to callOpenAIChat', async () => {
    vi.mocked(getOpenAIKeyForUser).mockResolvedValue('sk-test-key');
    vi.mocked(callOpenAIChat).mockResolvedValue('Sure!');

    const messages = [
      { role: 'user' as const, content: 'What can I make with chicken?' },
      { role: 'assistant' as const, content: 'You could make chicken curry.' },
      { role: 'user' as const, content: 'Give me the recipe' },
    ];

    await chat(mockContext(), { messages });

    expect(callOpenAIChat).toHaveBeenCalledWith('sk-test-key', messages);
  });

  it('should use the userId-specific stored key', async () => {
    vi.mocked(getOpenAIKeyForUser).mockResolvedValue('sk-user-provided-key');
    vi.mocked(callOpenAIChat).mockResolvedValue('Response');

    await chat(mockContext(), { messages: [{ role: 'user', content: 'Hello' }] });

    expect(callOpenAIChat).toHaveBeenCalledWith('sk-user-provided-key', expect.anything());
  });

  it('should throw when OpenAI call fails', async () => {
    vi.mocked(getOpenAIKeyForUser).mockResolvedValue('sk-test-key');
    vi.mocked(callOpenAIChat).mockRejectedValue(new Error('OpenAI API error'));

    await expect(
      chat(mockContext(), { messages: [{ role: 'user', content: 'Hello' }] })
    ).rejects.toThrow('OpenAI API error');
  });
});
