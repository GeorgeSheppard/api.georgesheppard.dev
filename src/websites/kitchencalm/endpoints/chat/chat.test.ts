import { describe, it, expect, vi, beforeEach } from 'vitest';
import { chat } from './chat.js';
import { createMockContext } from '@test/utils/mock-context.js';
import type { ContextWithUserId } from '@core/types/context.js';

vi.mock('../../utils/openai-chat.js');
vi.mock('@config/index.js', () => ({
  config: { OPENAI_API_KEY: 'sk-test-key' },
}));

import { callOpenAIChat } from '../../utils/openai-chat.js';

const validUserId = '550e8400-e29b-41d4-a716-446655440000';

function mockContext(userId = validUserId) {
  return createMockContext<ContextWithUserId>({ userId });
}

describe('chat handler', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return the AI response message', async () => {
    vi.mocked(callOpenAIChat).mockResolvedValue('Here is a great pasta recipe...');

    const result = await chat(mockContext(), {
      messages: [{ role: 'user', content: 'Find me a pasta recipe' }],
    });

    expect(result).toEqual({ message: 'Here is a great pasta recipe...' });
  });

  it('should pass apiKey, messages, and context to callOpenAIChat', async () => {
    vi.mocked(callOpenAIChat).mockResolvedValue('Sure!');

    const messages = [{ role: 'user' as const, content: 'What can I make with chicken?' }];
    const c = mockContext();

    await chat(c, { messages });

    expect(callOpenAIChat).toHaveBeenCalledWith('sk-test-key', messages, c);
  });

  it('should throw when OpenAI call fails', async () => {
    vi.mocked(callOpenAIChat).mockRejectedValue(new Error('OpenAI API error'));

    await expect(
      chat(mockContext(), { messages: [{ role: 'user', content: 'Hello' }] })
    ).rejects.toThrow('OpenAI API error');
  });
});
