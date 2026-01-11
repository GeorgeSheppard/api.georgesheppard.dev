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

## Rules

1. Never use `any`.
2. Understand and use the existing structure of the codebase so that patterns are followed.
3. Ask clarifications if specifications are unclear.
4. Use `pnpm`.
