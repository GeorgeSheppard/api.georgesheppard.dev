# Server

## Mac mini

If you are starting fresh to host on the mac mini.

Create a `.env.server` from the `.env.server.example` file (Paths should be relative to the `ml` folder).

Start the text extraction service from the `ml` root with:
`uv run --env-file=.env.server fastapi run app/main.py`

Copy the `Infra` folder and make a folder outside of the Shelfie repository (once the docker images start we will
have volumes so best to keep those outside the repo).

### Deployment polling + secrets via Infisical

There's no inbound deploy webhook and no self-hosted runner. A `launchd` job (`com.docker.compose.update`) on the
mac mini runs every 5 minutes from the compose directory (e.g. `~/Documents/root`) and runs `deploy.sh`, which
overwrites the local `compose.yaml` with the latest `infra/compose.yaml` from `master`, regenerates `.env` from
Infisical, and then does `docker compose pull && docker compose up -d --remove-orphans`. `docker compose up -d`
only recreates containers whose image or config actually changed, so this is safe to run unconditionally every
5 minutes — no manual diffing needed. Secrets are no longer kept in a hand-edited `.env` on the box — updating a
credential in Infisical takes effect on the next run, no SSH session needed.

`deploy.sh` pings a [healthchecks.io](https://healthchecks.io) check at the start and end of every run (and its
`/fail` variant if any step errors, via a `trap`). That check has a grace period longer than 5 minutes, so if this
job stops succeeding — an expired Infisical credential, the `launchd` agent itself no longer running, Docker being
down, anything — healthchecks.io emails an alert instead of the outage going unnoticed. The ping URL is a plain
constant near the top of `deploy.sh`; update it there if the check is ever recreated.

One-time setup on the mac mini:

1. Create a Machine Identity in Infisical (Universal Auth) scoped to read access on the production environment.
2. Install the [Infisical CLI](https://infisical.com/docs/cli/overview) and Docker.
3. Copy `deploy.sh` into the compose directory (alongside `compose.yaml`) and make it executable:
   ```
   chmod +x ~/Documents/root/deploy.sh
   ```
4. Store the Machine Identity credentials somewhere only readable by you, e.g.
   `~/.config/infisical/mac-mini.env` (`chmod 600`):
   ```
   export INFISICAL_CLIENT_ID="..."
   export INFISICAL_CLIENT_SECRET="..."
   export INFISICAL_PROJECT_ID="..."
   ```
5. Replace `~/Library/LaunchAgents/com.docker.compose.update.plist` with the copy checked in here at
   `com.docker.compose.update.plist`, which sources that file and calls `deploy.sh` instead of running
   `docker compose pull && up` directly:
   ```
   cp infra/com.docker.compose.update.plist ~/Library/LaunchAgents/com.docker.compose.update.plist
   ```
6. Reload the job: `launchctl unload ~/Library/LaunchAgents/com.docker.compose.update.plist && launchctl load ~/Library/LaunchAgents/com.docker.compose.update.plist`

The deploy flow becomes: push to `master` → GitHub Actions builds and pushes the image → within 5 minutes the mac
mini pulls the new image, refreshes secrets from Infisical, and restarts anything that changed.

You should now be good to test.

## Manual updates

### Update to latest images

Run `~/Documents/root/deploy.sh` directly to force an immediate check rather than waiting for the launchd job.
Check `deployment.yml` in the main repo for how images get built and pushed.

### Manually building

See individual readme's for information on building.

## Postgres

The database is persisted to a volume in `pg_data`. This means whatever you do do not delete that volume. E.g. DO NOT RUN `docker compose down -v` as this deletes volumes.

The database isn't exposed outside of the docker network, so to access it you need to exec into it.

To do this, first list the docker containers with:  
`docker ps`

Then exec into the postgres container with:  
`docker exec -it <container ID> /bin/bash`

You can then use `psql` to access the DB:  
`psql -h localhost -p 5432 -U postgres postgres`

### Example commands

List all relations:  
`\d+;`

Get first 10 images rows:  
`SELECT * FROM images LIMIT 10;`

Get first 10 request rows:  
`SELECT * FROM requests LIMIT 10;`

Add sample data into requests and images:

```sql
WITH req AS (
  INSERT INTO requests (email, created_utc)
  VALUES ('testuser2@example.com', '2025-02-02 13:00:00+00')
  RETURNING id
)
INSERT INTO images (request_id, image, content_type, extracted_books, processed_utc)
SELECT req.id, '\\x89504e470d0a1a0a0000000d4948445200000001000000010802000000c2eb6b0d0000', 'image/png',
       '[{"title": "Moby Dick", "author": null}, {"title": "Pride and Prejudice", "author": null}]',
       '2025-02-02 13:10:00+00'
FROM req;
```

Update the extracted books for a request's images based on the email (Note: there can be multiple requests, and
multiple images per request, associated with one email — this updates every image belonging to the most recent
request):

```sql
WITH req AS (
  SELECT id
  FROM requests
  WHERE email = 'testuser2@example.com'
  ORDER BY created_utc DESC
  LIMIT 1
)
UPDATE images
SET extracted_books = '[{"title": "The Hobbit", "author": null}, {"title": "Harry Potter", "author": null}]',
    processed_utc = '2025-02-02 14:30:00+00'
FROM req
WHERE images.request_id = req.id;
```

## RabbitMQ

The queues (that define themselves as durable) are persisted to `./rabbitmq`. This means whatever you do do not delete that volume. E.g. DO NOT RUN `docker compose down -v` as this deletes volumes.

### Management console

Both local and prod composes expose a management port (15672) that allows you to interact with RabbitMQ through a UI.

## Cronjob

Fill in the environment variable required for the cronjob. This will be loaded in by the scheduler.

## Observability

### Metrics (OTel Collector)

The app already exports OpenTelemetry traces/logs/metrics (`src/core/telemetry`) to whatever OTLP backend
`OTEL_EXPORTER_OTLP_ENDPOINT` points at (Grafana). The `otel-collector` service adds metrics for things the app
itself can't see: host resources, Postgres stats, and full RabbitMQ stats (the app only tracks queue depth via
`src/core/queue/client.ts`; the collector's `rabbitmqreceiver` adds consumer counts, unacked messages, node/connection
stats, etc). It uses the same OTLP endpoint, plus one extra secret:

- `OTEL_COLLECTOR_AUTHORIZATION_HEADER` — the full `Authorization` header value your Grafana OTLP endpoint expects
  (e.g. `Basic <base64>` or `Bearer <token>`). Add it to Infisical alongside the other secrets; it's picked up via
  `env_file: .env` like everything else.

Its config lives in `infra/otel-collector-config.yaml` and is refreshed from `master` on every `deploy.sh` run, the
same way `compose.yaml` is — edit it in the repo, not on the box.

### RabbitMQ management UI and on-demand SQL (Adminer)

Both `queues` (port 15672) and `adminer` are only reachable inside the docker network (`http://queues:15672`,
`http://adminer:8080`) — they are not published to the host or the internet directly. To reach them:

1. In the Cloudflare Zero Trust dashboard, add a public hostname to the existing tunnel for each
   (e.g. `rabbitmq.georgesheppard.dev` → `http://queues:15672`, `sql.georgesheppard.dev` → `http://adminer:8080`).
2. Put each hostname behind a Cloudflare Access application/policy (e.g. allow only your email) so they're never
   reachable without auth — Adminer in particular is a raw SQL console against the production DB.

When prompted by Adminer, connect with system `postgres`, server `db`, and the `DATABASE_USER`/`DATABASE_PASSWORD`/
`DATABASE_DB` values from Infisical.
