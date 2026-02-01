import { App, AppDependencies, createApp } from '../../src/server.js';

/**
 * Creates a placeholder that throws a helpful error when any property is accessed.
 * Used when a test doesn't provide a mock for a dependency it doesn't need.
 */
function createMissingDependencyProxy<T extends object>(name: string): T {
  return new Proxy({} as T, {
    get(_target, prop) {
      throw new Error(
        `Test attempted to access '${String(prop)}' on '${name}', but no mock was provided. ` +
          `Add '${name}' to your createTestApp() call.`
      );
    },
  });
}

/**
 * Creates a Hono app for testing with only the dependencies you need.
 *
 * Any dependencies not provided will throw a helpful error if accessed during the test.
 * This allows tests to only set up the mocks they actually use.
 *
 * @example
 * // Test that only needs database access
 * const app = await createTestApp({
 *   databaseClient: await createDatabaseClient(config.DATABASE_URL),
 * });
 *
 * @example
 * // Test that needs database and email
 * const app = await createTestApp({
 *   databaseClient: await createDatabaseClient(config.DATABASE_URL),
 *   emailClient: createMockEmailClient(),
 * });
 */
export async function createTestApp(dependencies: Partial<AppDependencies>): Promise<App> {
  const fullDependencies: AppDependencies = {
    databaseClient: dependencies.databaseClient ?? createMissingDependencyProxy('databaseClient'),
    queueClient: dependencies.queueClient ?? createMissingDependencyProxy('queueClient'),
    emailClient: dependencies.emailClient ?? createMissingDependencyProxy('emailClient'),
    ipLocator: dependencies.ipLocator ?? createMissingDependencyProxy('ipLocator'),
    dynamoClient: dependencies.dynamoClient ?? createMissingDependencyProxy('dynamoClient'),
  };

  return createApp(fullDependencies);
}
