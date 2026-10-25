# api.georgesheppard.dev monolith

Monolith for a collection of websites running on the georgesheppard.dev domain.

## Local development

Containers (local Postgres/RabbitMQ via `compose.yaml`, and the testcontainers used by integration tests) run on
[OrbStack](https://orbstack.dev), not Docker Desktop. It provides the usual `docker` / `docker compose` CLIs.

```bash
brew install orbstack
orb start
docker compose up -d   # Postgres + RabbitMQ (+ ML service)
pnpm install
pnpm dev               # HTTP server
pnpm dev:worker        # queue worker
pnpm test:integration  # needs OrbStack running
```

See `infra/README.md` for running the production stack on the mac mini.
