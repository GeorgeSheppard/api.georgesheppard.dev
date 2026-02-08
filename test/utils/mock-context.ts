import { vi } from 'vitest';
import type { Context } from 'hono';

type MockContextDeps = {
  [key: string]: unknown;
};

/**
 * Creates a mock Hono context for unit testing handler functions.
 *
 * Only provide the dependencies your handler actually accesses via c.get().
 * Accessing a dependency not provided will throw a helpful error,
 * mirroring the createTestApp() pattern for integration tests.
 *
 * @example
 * // Handler that accesses userId and dynamoClient
 * const c = createMockContext<ContextWithUserId>({
 *   userId: '550e8400-e29b-41d4-a716-446655440000',
 *   dynamoClient: { client: {} },
 * });
 *
 * @example
 * // Handler that only accesses databaseClient
 * const c = createMockContext({
 *   databaseClient: { db: {} },
 * });
 */
export function createMockContext<T extends Context = Context>(deps: MockContextDeps = {}): T {
  return {
    get: vi.fn((key: string) => {
      if (key in deps) return deps[key];
      throw new Error(
        `Test attempted to access '${key}' from context, but no mock was provided. ` +
          `Add '${key}' to your createMockContext() call.`
      );
    }),
  } as unknown as T;
}
