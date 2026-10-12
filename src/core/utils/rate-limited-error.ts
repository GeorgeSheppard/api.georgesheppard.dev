import { z } from 'zod';

// Thrown when an upstream provider's rate limit is reached; the error handler turns it into a 429
// so clients can back off rather than treating it as a failure.
export class RateLimitedError extends Error {
  readonly status = 429;
  readonly retryAfterSeconds: number;

  constructor(message: string, retryAfterSeconds: number) {
    super(message);
    this.retryAfterSeconds = retryAfterSeconds;
  }
}

export const RateLimitedResponseSchema = z.object({
  error: z.string(),
  retryAfterSeconds: z.number().describe('How long to wait before trying again'),
});
