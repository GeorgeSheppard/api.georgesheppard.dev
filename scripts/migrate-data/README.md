# Data Migration Script

This script migrates recipes and meal plans from one user account to another.

## Prerequisites

- Node.js and pnpm installed
- Environment variables configured in `.env` file:
  - `AWS_REGION`
  - `AWS_ACCESS_KEY_ID`
  - `AWS_SECRET_ACCESS_KEY`
  - `DYNAMODB_TABLE_NAME`
  - `JWT_SECRET`

## Obtaining MCP Tokens

To get an MCP token for an account:

1. Log in to the account in your application
2. Make a POST request to `/mcp/auth/token` with a valid Cognito JWT
3. The response will contain the MCP token

Alternatively, if you already have the user's Cognito JWT, you can use the auth endpoint to exchange it for an MCP token.

## Usage

### Option 1: Using Environment Variables (Recommended)

Add the MCP tokens to your `.env` file:

```bash
SOURCE_ACCOUNT="Bearer eyJhbGciOiJIUzI1NiJ9.eyJ1c2VySWQiOiJzb3VyY2UtdXNlci1pZCIsImlhdCI6MTcwMDAwMDAwMH0.abc123..."
TARGET_ACCOUNT="Bearer eyJhbGciOiJIUzI1NiJ9.eyJ1c2VySWQiOiJ0YXJnZXQtdXNlci1pZCIsImlhdCI6MTcwMDAwMDAwMH0.def456..."
```

Then run:

```bash
pnpm tsx scripts/migrate-data/migrate.ts
```

### Option 2: Using Command-Line Arguments

```bash
pnpm tsx scripts/migrate-data/migrate.ts <source-token> <target-token>
```

**Parameters:**

- `source-token`: MCP JWT token for the source account (without "Bearer " prefix)
- `target-token`: MCP JWT token for the target account (without "Bearer " prefix)

**Example:**

```bash
pnpm tsx scripts/migrate-data/migrate.ts \
  "eyJhbGciOiJIUzI1NiJ9.eyJ1c2VySWQiOiJzb3VyY2UtdXNlci1pZCIsImlhdCI6MTcwMDAwMDAwMH0.abc123..." \
  "eyJhbGciOiJIUzI1NiJ9.eyJ1c2VySWQiOiJ0YXJnZXQtdXNlci1pZCIsImlhdCI6MTcwMDAwMDAwMH0.def456..."
```

## What Gets Migrated

The script migrates:

1. **All recipes** - Including name, description, components, ingredients, and instructions
2. **All recipe images** - The actual image files are copied from the source user's S3 folder to the target user's S3 folder
3. **Meal plan** - All meal plan entries with their dates and associated recipes

## Important Notes

### Performance and Throttling

- The script processes recipes **sequentially** (one at a time) to avoid DynamoDB throttling errors
- There's a 200ms delay between each recipe write to DynamoDB
- There's a 100ms delay between each S3 image copy operation
- For large recipe collections, the migration may take several minutes
- This throttling is necessary to stay within DynamoDB's provisioned throughput limits

### Images

- The script automatically copies all image files from the source user to the target user in S3
- Image keys are updated from `{sourceUserId}/{filename}` to `{targetUserId}/{filename}`
- If an image copy fails, the script will log an error but continue with the migration
- The recipe will keep the original image key if the copy fails (the target user won't be able to access it)

### UUIDs

- Recipe UUIDs are preserved during migration
- Component UUIDs are preserved during migration
- This ensures that meal plan references remain valid after migration

### Data Overwriting

- **CAUTION**: This script will overwrite any existing recipes in the target account that have the same UUID
- The meal plan in the target account will be completely replaced with the source account's meal plan

### Dry Run

If you want to test the migration without actually writing data, you can comment out the `updateRecipe` and `updateMealPlan` calls in the script and just let it fetch and display the data.

## Troubleshooting

### "Failed to decode token"

- Ensure the tokens are valid MCP JWT tokens
- Check that the tokens contain a `userId` field
- Verify the tokens are not expired (though the script doesn't validate expiration)

### "Failed to fetch recipes/meal plan"

- Ensure your AWS credentials are correct in the `.env` file
- Verify the DynamoDB table name is correct
- Check that the source user actually has data to migrate

### "Failed to update recipe/meal plan"

- Ensure the target user exists in the system
- Verify your AWS credentials have write permissions to DynamoDB
- Check the DynamoDB table has the correct schema

## Safety Recommendations

1. **Backup**: Before running this script, consider backing up the target account's data if it has any
2. **Test first**: Run the script with a test account first to ensure it works as expected
3. **Verify**: After migration, manually verify that the data appears correctly in the target account
