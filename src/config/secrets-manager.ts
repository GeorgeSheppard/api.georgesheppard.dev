import { SecretsManagerClient, GetSecretValueCommand } from '@aws-sdk/client-secrets-manager';

/**
 * Load secrets from AWS Secrets Manager.
 * If NODE_ENV is not production, secrets loading is skipped (uses process.env instead).
 * In production, all secrets defined in the schema must exist in Secrets Manager.
 */
export async function loadSecretsFromAWS(): Promise<void> {
  if (process.env.NODE_ENV !== 'production') {
    return; // Skip in non-production environments
  }

  const secretName = process.env.AWS_SECRETS_NAME;
  if (!secretName) {
    throw new Error(
      'AWS_SECRETS_NAME environment variable is required in production to load secrets from AWS Secrets Manager'
    );
  }

  const region = process.env.AWS_REGION || 'us-east-1';

  const client = new SecretsManagerClient({ region });

  try {
    const command = new GetSecretValueCommand({ SecretId: secretName });
    const response = await client.send(command);

    let secrets: Record<string, string> = {};

    if (response.SecretString) {
      secrets = JSON.parse(response.SecretString);
    } else if (response.SecretBinary) {
      const buffer = Buffer.from(response.SecretBinary);
      secrets = JSON.parse(buffer.toString('utf-8'));
    }

    // Merge secrets into process.env, with process.env taking precedence
    // This allows for environment-specific overrides
    Object.entries(secrets).forEach(([key, value]) => {
      if (!(key in process.env)) {
        process.env[key] = value;
      }
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Failed to load secrets from AWS Secrets Manager (${secretName}): ${message}`);
  } finally {
    client.destroy();
  }
}
