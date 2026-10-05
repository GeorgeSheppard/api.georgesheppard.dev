# Server

## Mac mini

If you are starting fresh to host on the mac mini.

Create a `.env.server` from the `.env.server.example` file (Paths should be relative to the `ml` folder).

Start the text extraction service from the `ml` root with:
`uv run --env-file=.env.server fastapi run app/main.py`

Copy the `Infra` folder and make a folder outside of the Shelfie repository (once the containers start we will
have volumes so best to keep those outside the repo).

### Installing / updating the setup (`install.sh`)

Everything on the box is set up by `infra/install.sh`. It's idempotent, so whenever anything in `infra/` changes
(or you're not sure the box is in the right state) pull the repo on the mac mini and re-run it:

```
infra/install.sh
```

It:

1. Installs Homebrew, [OrbStack](https://orbstack.dev) and the [Infisical CLI](https://infisical.com/docs/cli/overview)
   if missing, starts OrbStack, points the `docker` CLI at it and turns on OrbStack's **Start at login**.
2. Sets power settings so the box never sleeps and powers back on after a power cut (`pmset`, asks for your password).
   It warns if automatic login is off, as without it nothing starts after a reboot until someone logs in.
3. Prompts for the Infisical Machine Identity credentials the first time and stores them in
   `~/.config/infisical/mac-mini.env` (`chmod 600`). Delete that file and re-run to change them.
4. Copies `deploy.sh` into the compose directory (`~/Documents/root`, override with `COMPOSE_DIR=...`) and copies any
   missing `cronjobs` (existing ones are left alone as their secrets are filled in by hand).
5. Writes `~/Library/LaunchAgents/com.docker.compose.update.plist` and (re)loads it, which kicks off a deploy
   immediately.

Before the first run, create a Machine Identity in Infisical (Universal Auth) scoped to read access on the production
environment.

OrbStack ships the standard `docker` and `docker compose` CLIs, so every `docker ...` command in this README works
as-is.

### Deployment polling + secrets via Infisical

There's no inbound deploy webhook and no self-hosted runner. The `launchd` job (`com.docker.compose.update`) runs
`deploy.sh` at login and then every 5 minutes. It overwrites the local `compose.yaml` with the latest
`infra/compose.yaml` from `master`, regenerates `.env` from Infisical, starts OrbStack if it isn't running, and then
does `docker compose pull && docker compose up -d --remove-orphans`. `docker compose up -d` only recreates containers
whose image or config actually changed, so this is safe to run unconditionally every 5 minutes — no manual diffing
needed. Secrets are not kept in a hand-edited `.env` on the box — updating a credential in Infisical takes effect on
the next run, no SSH session needed.

Every service has `restart: always`, so containers are restarted if they crash and come back when OrbStack starts.
Together with OrbStack starting at login, automatic login and `autorestart` after power loss, the stack recovers from a
reboot or power cut without intervention.

`deploy.sh` pings a [healthchecks.io](https://healthchecks.io) check at the start and end of every run (and its
`/fail` variant if any step errors, via a `trap`). That check has a grace period longer than 5 minutes, so if this
job stops succeeding — an expired Infisical credential, the `launchd` agent itself no longer running, OrbStack being
down, anything — healthchecks.io emails an alert instead of the outage going unnoticed. The ping URL is a plain
constant near the top of `deploy.sh`; update it there if the check is ever recreated.

The deploy flow is: push to `master` → GitHub Actions builds and pushes the image → within 5 minutes the mac mini
pulls the new image, refreshes secrets from Infisical, and restarts anything that changed. Logs are in
`~/docker-launchd.log`.

### Migrating from Docker Desktop

Postgres and RabbitMQ data live in bind mounts (`./pgdata`, `./rabbitmq`) in the compose directory, not in Docker
Desktop's VM, so nothing needs copying across — images are re-pulled by `deploy.sh`.

1. Stop the stack while Docker Desktop is still running (no `-v`!):
   ```
   cd ~/Documents/root && docker compose down
   ```
2. Quit Docker Desktop and turn off its "Start Docker Desktop when you sign in" setting.
3. Run `infra/install.sh`. It reuses the existing credentials file and replaces the old launchd job.
4. Check everything came up with `docker compose ps` and `tail ~/docker-launchd.log`.
5. Once happy, uninstall Docker Desktop. Optionally, `orb migrate docker` can import any leftover images/volumes
   from Docker Desktop first, but the stack itself doesn't need it.

## Manual updates

### Update to latest images

Run `launchctl kickstart gui/$(id -u)/com.docker.compose.update` to force an immediate deploy rather than waiting for
the launchd job.
Check `deployment.yml` in the main repo for how images get built and pushed.

### Manually building

See individual readme's for information on building.

## Postgres

The database is persisted to a volume in `pg_data`. This means whatever you do do not delete that volume. E.g. DO NOT RUN `docker compose down -v` as this deletes volumes.

The database isn't exposed outside of the compose network, so to access it you need to exec into it.

To do this, first list the containers with:  
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
