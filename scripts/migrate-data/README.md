# Account Merge Script

Merges recipes and the meal plan from a **source** account into a **target** account, optionally deleting the source account's data afterwards.

- Recipes whose title already exists on the target (case/whitespace-insensitive) are skipped, so nothing is duplicated.
- Existing target recipes are never modified. If a copied recipe's UUID already exists on the target, it gets a new UUID.
- Recipe images are copied in S3 from `{sourceUserId}/...` to `{targetUserId}/...`.
- Meal plans are merged by date. Entries for skipped duplicates are pointed at the target's matching recipe (components matched by name), and a recipe already planned on a day is not added twice.

## Prerequisites

`.env` must contain the production `DYNAMODB_*`, `S3_*` and `JWT_SECRET` values.

## Obtaining Tokens

Log in to each account and exchange its Cognito JWT for an MCP token via `POST /mcp/auth/token`. The script only reads the `userId` claim from the token.

## Usage

Tokens can be passed as arguments or set as `SOURCE_ACCOUNT` / `TARGET_ACCOUNT` (a `Bearer ` prefix is fine).

```bash
# 1. Dry run (default): shows what would be copied/skipped, writes nothing
pnpm tsx scripts/migrate-data/migrate.ts <source-token> <target-token>

# 2. Merge
pnpm tsx scripts/migrate-data/migrate.ts --apply <source-token> <target-token>

# 3. Merge and delete the source account's recipes, images and meal plan
pnpm tsx scripts/migrate-data/migrate.ts --apply --delete-source <source-token> <target-token>
```

The merge is safe to re-run: recipes copied on a previous run are detected as duplicates.

`--delete-source` is refused if any image copy failed. It deletes the source account's data only, not its Cognito login; remove that from the Cognito user pool in the AWS console.

## Throttling

Recipes are processed sequentially with a 1s delay between DynamoDB writes and 100ms between S3 operations, so large accounts take a few minutes.
