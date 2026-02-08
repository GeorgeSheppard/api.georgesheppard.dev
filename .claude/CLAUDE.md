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

## Rules

1. Never use `any`.
2. Understand and use the existing structure of the codebase so that patterns are followed.
3. Ask clarifications if specifications are unclear.
4. Use `pnpm`.
5. Use `.js` extensions in all import statements, even though this is a TypeScript project. This is necessary for ESM compatibility and matches the project's build output.
6. Verify your work by using `pnpm lint`
7. Keep code minimal and concise. Only add comments where logic is non-obvious. Do not add documentation comments (JSDoc) or verbose annotations for every function and import. Let the code be self-documenting through clear naming.
