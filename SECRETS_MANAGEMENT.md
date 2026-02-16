# External Secrets Management

This application supports loading environment variables from AWS Secrets Manager in production environments.

## Overview

Instead of manually updating `.env` files and SSH-ing into your server, you can now manage all application secrets centrally in AWS Secrets Manager. The application automatically loads secrets from Secrets Manager on startup in production environments.

## Setup

### 1. Create a Secret in AWS Secrets Manager

Create a new secret in AWS Secrets Manager containing your environment variables as a JSON object:

```json
{
  "DATABASE_HOST": "your-db-host",
  "DATABASE_PORT": "5432",
  "DATABASE_USER": "your-user",
  "DATABASE_PASSWORD": "your-password",
  "DATABASE_DB": "your-db-name",
  "RABBITMQ_HOST": "your-rabbitmq-host",
  "RABBITMQ_PORT": "5672",
  "RABBITMQ_USER": "your-user",
  "RABBITMQ_PASSWORD": "your-password",
  "API_KEY": "your-api-key",
  "MAILGUN_API_KEY": "your-mailgun-key",
  "OPENAI_API_KEY": "your-openai-key",
  "TEXT_EXTRACTOR_URL": "https://your-extractor-url",
  "JWT_SECRET": "your-jwt-secret-min-32-chars",
  "COGNITO_REGION": "us-east-1",
  "COGNITO_USER_POOL_ID": "your-pool-id",
  "COGNITO_CLIENT_ID": "your-client-id",
  "ENCRYPTION_KEY": "32-character-key-for-aes-256",
  "ENCRYPTION_IV": "16-character-iv",
  "DYNAMODB_REGION": "eu-west-2",
  "DYNAMODB_TABLE_NAME": "your-table",
  "DYNAMODB_ACCESS_KEY_ID": "your-access-key",
  "DYNAMODB_SECRET_ACCESS_KEY": "your-secret-key",
  "DYNAMODB_ENDPOINT": "https://your-endpoint-optional",
  "S3_REGION": "eu-west-2",
  "S3_BUCKET_NAME": "your-bucket",
  "S3_ACCESS_KEY_ID": "your-access-key",
  "S3_SECRET_ACCESS_KEY": "your-secret-key",
  "S3_ENDPOINT": "https://your-endpoint-optional"
}
```

### 2. Set Environment Variables

On your production server, set the following environment variables:

```bash
# Required in production
export AWS_SECRETS_NAME="your-secret-name"  # Name of the secret in Secrets Manager
export AWS_REGION="us-east-1"               # AWS region (optional, defaults to us-east-1)
export NODE_ENV="production"
```

### 3. Configure AWS Credentials

The application uses the AWS SDK, which will automatically use credentials from:

- Environment variables: `AWS_ACCESS_KEY_ID` and `AWS_SECRET_ACCESS_KEY`
- IAM role (recommended for EC2, ECS, or Lambda)
- AWS credentials file: `~/.aws/credentials`
- AWS config file: `~/.aws/config`

**Recommendation**: Use IAM roles instead of hardcoded credentials when possible.

## How It Works

1. When the application starts (in production only), it automatically calls `initializeConfig()`
2. `initializeConfig()` calls `loadSecretsFromAWS()`
3. `loadSecretsFromAWS()`:
   - Skips loading if `NODE_ENV` is not "production"
   - Retrieves the secret from AWS Secrets Manager
   - Parses the JSON secret
   - Merges the secrets into `process.env` (existing environment variables take precedence)
   - Validates all required environment variables using the Zod schema in `src/config/env.ts`

## Local Development

In development and test environments, the application uses `.env` and `.env.test` files as usual. The `loadSecretsFromAWS()` function skips execution when `NODE_ENV` is not "production".

## Updating Secrets

To update a secret:

1. Update the secret value in AWS Secrets Manager
2. Restart the application

The application will automatically load the new secret values on the next startup.

## Precedence

Environment variables are merged with the following precedence (highest to lowest):

1. Environment variables already set in the shell
2. Secrets loaded from AWS Secrets Manager (in production only)
3. Dotenv variables from `.env` file

This means you can override any secret by setting an environment variable directly.

## Troubleshooting

### "AWS_SECRETS_NAME environment variable is required"

This error occurs in production when `AWS_SECRETS_NAME` is not set. Ensure the environment variable is properly configured on your server.

### "Failed to load secrets from AWS Secrets Manager"

Check that:

1. The AWS Secrets Manager secret exists and has the correct name
2. The AWS credentials are properly configured
3. The IAM role/user has `secretsmanager:GetSecretValue` permission for the secret
4. The AWS region is correct

### Missing required environment variables

Ensure all required variables in `src/config/env.ts` are present in your AWS Secrets Manager secret.

## Security Best Practices

1. Use IAM roles instead of hardcoded credentials
2. Restrict access to the AWS Secrets Manager secret using IAM policies
3. Use AWS Secrets Manager's rotation feature for sensitive secrets like database passwords
4. Monitor access to secrets using AWS CloudTrail
5. Never commit secrets to version control

## Files Modified

- `src/config/secrets-manager.ts` - AWS Secrets Manager client and loading logic
- `src/config/index.ts` - Integration with initialization flow
- `src/index.ts` - Call `initializeConfig()` at application startup
- `src/core/queue/worker.ts` - Call `initializeConfig()` for worker process
- `vitest.config.ts` - Setup files to initialize config before tests
