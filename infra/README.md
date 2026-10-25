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

1. Pauses the deploy launchd job, so nothing deploys while it runs.
2. Installs Homebrew, [OrbStack](https://orbstack.dev) and the [Infisical CLI](https://infisical.com/docs/cli/overview)
   if missing, starts OrbStack and turns on its **Start at login**.
3. Sets power settings so the box never sleeps and powers back on after a power cut (`pmset`, asks for your password).
   It warns if automatic login is off, as without it nothing starts after a reboot until someone logs in.
4. Stores the Infisical Machine Identity credentials in `~/.config/infisical/mac-mini.env` (`chmod 600`), prompting
   for them the first time. These are the only secrets kept on the box, everything else comes from Infisical (see
   below). To rotate them, re-run with the new values set:
   `INFISICAL_CLIENT_ID=... INFISICAL_CLIENT_SECRET=... INFISICAL_PROJECT_ID=... infra/install.sh`
5. Switches `~/.docker/config.json` off Docker Desktop's credential helper and pre-pulls every image into OrbStack,
   running `docker login` if the private api image can't be pulled.
6. Copies `deploy.sh` into the compose directory (`~/Documents/root`, override with `COMPOSE_DIR=...`).
7. Stops here if Docker Desktop is running (see the migration below). Otherwise points the `docker` CLI at OrbStack,
   writes `~/Library/LaunchAgents/com.docker.compose.update.plist` and loads it, which kicks off a deploy immediately.

Steps 1-6 never touch running containers, so re-running it on a live box only causes a deploy, which is a no-op if
nothing changed.

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
needed.

Secrets are not kept in a hand-edited `.env` on the box — updating a secret in Infisical takes effect within 5
minutes, no SSH session or re-running `install.sh` needed. Compose doesn't notice changes inside an `env_file` by
itself, so `deploy.sh` compares the freshly exported `.env` with the last successfully deployed one
(`.env.deployed`) and force-recreates `api` when anything changed. Note that Postgres only reads `DATABASE_PASSWORD` when it first creates the
database, so rotating that one also needs an `ALTER USER ... PASSWORD` in `psql`.

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

The data lives in bind mounts (`./pgdata`, `./rabbitmq`) in the compose directory, not in Docker Desktop's VM, so
nothing needs copying. Everything slow (installing, logging in, pulling images) happens while Docker Desktop is still
serving traffic, so the downtime is just stopping the old stack and starting the new one, typically 1-2 minutes. The
two runtimes must never both run the stack, as two Postgres servers on one `./pgdata` can corrupt it, which is why
`install.sh` won't cut over while Docker Desktop is running.

**Prep (no downtime)**

1. On the mac mini, check out this branch (or `master` once merged) and run `infra/install.sh`. It prepares
   everything, then stops with a warning that Docker Desktop is still running. From now on automatic deploys are
   paused (healthchecks.io will start alerting, which is expected) and the old stack keeps serving.
2. Merge the PR if you haven't. Nothing on the box picks it up while deploys are paused.

**Cutover (downtime starts at step 5)**

3. Back up the database:
   ```
   cd ~/Documents/root
   docker --context desktop-linux compose exec -T db sh -c 'pg_dumpall -U "$POSTGRES_USER"' > ~/pg-backup-$(date +%F).sql
   ```
4. Check RabbitMQ has no messages waiting (the management UI on port 15672, or
   `docker --context desktop-linux exec rabbitmq rabbitmqctl list_queues`). The queues are re-created when the app
   starts, but RabbitMQ now gets a fixed hostname, which gives it a fresh data directory, so messages still queued
   would be left behind.
5. Stop the old stack (no `-v`!): `docker --context desktop-linux compose down`
6. Quit Docker Desktop and turn off its "Start Docker Desktop when you sign in" setting.
7. `git pull` and re-run `infra/install.sh`. It cuts over and starts the stack on OrbStack.
8. Check `tail -f ~/docker-launchd.log` shows "Deploy succeeded", then that `docker compose ps` shows everything
   running and healthy, and that the api responds through the tunnel. If Postgres won't start, check
   `docker compose logs db` first.

**Rollback** (if the stack won't come up on OrbStack)

1. `launchctl bootout gui/$(id -u)/com.docker.compose.update` then `docker compose down` and quit OrbStack.
2. Open Docker Desktop, `docker context use desktop-linux`, `cd ~/Documents/root && docker compose up -d`.
3. Automatic deploys stay off until you fix the problem and re-run `install.sh`.

Once you're happy, uninstall Docker Desktop and delete `~/Documents/root/cronjobs` (no longer used). Optionally,
`orb migrate docker` can import leftover images/volumes first, but the stack doesn't need it.

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

The `scheduler` service writes its cronjobs on start, using `API_KEY` from the Infisical-generated `.env`. Rotating
the key in Infisical changes the service's environment, so the next deploy recreates it with the new key. To add or
change a cronjob, edit the `scheduler` command in `compose.yaml`.
