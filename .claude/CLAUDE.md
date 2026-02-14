# Context

This is monolith backend for api.georgesheppard.dev. It features backends for multiple websites.

It uses `pnpm`, `hono`, `drizzle`, `postgres`, `rabbitmq`, `amqplib`.

We have a main thread for handling HTTP requests we can be started using:
`pnpm dev`

We have a worker thread for handling the queues connecting to `rabbitmq`, this can be started using:
`pnpm dev:worker`

Linting can be run by using:
`pnpm lint`

Integration tests using test containers are extensively used, these can be run by using:
`pnpm test:integration`

Basic unit tests can be run using:
`pnpm test`

When writing or modifying endpoints, follow the unit test guide at `test/UNIT_TEST_GUIDE.md` to ensure handlers are unit-testable. Run `pnpm test` to verify unit tests pass.

## Development Workflow

After making code changes, always run these steps before committing:

1. `pnpm lint:fix` - Fix TypeScript and ESLint issues
2. `pnpm format` - Format code with Prettier
3. `pnpm generate:openapi` - Regenerate OpenAPI spec (if endpoints changed)
4. `pnpm test` - Verify unit tests pass
5. Commit with a clear message

## Environment Variables

When adding new required environment variables:

1. Add to `src/config/env.ts` with Zod validation schema
2. Add to `.env.example` with a descriptive comment and placeholder value
3. Add to `.env.test` with a dummy/test value (required for local tests and OpenAPI generation)

All environment variables are validated once at app startup. See the `env` skill for detailed patterns.

## Test Environment Setup

- `.env.test` must have all required environment variables set (even with dummy values)
- This file is used by integration tests, unit tests, and the OpenAPI generation script
- When adding new required env vars, update `.env.test` before running tests
- The test environment should mirror production requirements while using safe test values

## Rules

1. Never use `any`.
2. Understand and use the existing structure of the codebase so that patterns are followed.
3. Ask clarifications if specifications are unclear.
4. Use `pnpm`.
5. Use `.js` extensions in all import statements, even though this is a TypeScript project. This is necessary for ESM compatibility and matches the project's build output.
6. Verify your work by using `pnpm lint`
7. Keep code minimal and concise. Only add comments where logic is non-obvious. Do not add documentation comments (JSDoc) or verbose annotations for every function and import. Let the code be self-documenting through clear naming.
