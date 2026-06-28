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
credential in Infisical takes effect on the next run, no SSH session needed. If the repo is private, set
`GITHUB_TOKEN` (a PAT with read access) alongside the Infisical credentials so `deploy.sh` can fetch the file.

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
  INSERT INTO requests (email, createdUtc, booksProcessed, booksProcessedUtc)
  VALUES
    ('testuser2@example.com', '2025-02-02 13:00:00+00',
     '{"books": ["Moby Dick", "Pride and Prejudice"]}',
     '2025-02-02 13:10:00+00')
  RETURNING id
)
INSERT INTO images (request_id, image)
SELECT req.id, '\\x89504e470d0a1a0a0000000d4948445200000001000000010802000000c2eb6b0d0000'
FROM req;
```

Update row in requests to add books based on the email (Note: There can be multiple rows associated to one email):

```sql
WITH req AS (
  SELECT id
  FROM requests
  WHERE email = 'testuser2@example.com'
  LIMIT 1
)
UPDATE requests
SET booksProcessed = '{"books": ["The Hobbit", "Harry Potter"]}',
    booksProcessedUtc = '2025-02-02 14:30:00+00'
FROM req
WHERE requests.id = req.id;
```

## RabbitMQ

The queues (that define themselves as durable) are persisted to `./rabbitmq`. This means whatever you do do not delete that volume. E.g. DO NOT RUN `docker compose down -v` as this deletes volumes.

### Management console

Both local and prod composes expose a management port (15672) that allows you to interact with RabbitMQ through a UI.

## Cronjob

Fill in the environment variable required for the cronjob. This will be loaded in by the scheduler.
