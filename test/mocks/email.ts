import { vi } from 'vitest';
import { EmailClient, SendEmailOptions } from '@core/utils/mailgun.js';

export function createMockEmailClient(): EmailClient {
  return {
    sendRecommendationsEmail: vi.fn(async (options: SendEmailOptions) => {
      // Mock implementation - does nothing
      return Promise.resolve();
    }),
  };
}
