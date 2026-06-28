# Server

## Mac mini

If you are starting fresh to host on the mac mini.

Create a `.env.server` from the `.env.server.example` file (Paths should be relative to the `ml` folder).

Start the text extraction service from the `ml` root with:
`uv run --env-file=.env.server fastapi run app/main.py`

Copy the `Infra` folder and make a folder outside of the Shelfie repository (once the docker images start we will
have volumes so best to keep those outside the repo).

### Secrets via Infisical

Secrets are no longer kept in a hand-edited `.env` on the box. Instead `deploy.sh` pulls them from Infisical at
deploy time using a Machine Identity (Universal Auth), so credential changes only require updating Infisical and
re-running the deploy — no SSH session needed to edit files.

One-time setup on the mac mini:

1. Create a Machine Identity in Infisical (Universal Auth) scoped to read access on the production environment.
2. Set the following as persistent host environment variables (e.g. in `~/.zshrc` or a launchd plist), not in a file
   in this repo:
   - `INFISICAL_CLIENT_ID`
   - `INFISICAL_CLIENT_SECRET`
   - `INFISICAL_PROJECT_ID`
3. Install the [Infisical CLI](https://infisical.com/docs/cli/overview).

Then deploy/update with:
`./deploy.sh`

This regenerates `.env` from Infisical, pulls the latest images, and restarts the stack with
`docker compose up -d --remove-orphans`. Hook this script into whatever already triggers image pulls on the mac
mini, in place of a bare `docker compose pull && docker compose up -d`.

You should now be good to test.

## Manual updates

### Update to latest images

Run `./deploy.sh` from the `Infra` folder. Check `deployment.yml` in the main repo for how images get built and
pushed.

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
