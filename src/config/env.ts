import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number(),

  // Database
  DATABASE_HOST: z.string(),
  DATABASE_PORT: z.coerce.number(),
  DATABASE_USER: z.string(),
  DATABASE_DB: z.string(),
  DATABASE_PASSWORD: z.string(),
  DATABASE_MIGRATIONS_PATH: z.string(),

  // RabbitMQ
  RABBITMQ_HOST: z.string(),
  RABBITMQ_PORT: z.coerce.number(),
  RABBITMQ_USER: z.string(),
  RABBITMQ_PASSWORD: z.string(),

  // API Keys
  API_KEY: z.string(),
  MAILGUN_API_KEY: z.string(),
  OPENAI_API_KEY: z.string(),
  TEXT_EXTRACTOR_URL: z.string().url(),

  // JWT
  JWT_SECRET: z.string().min(32).describe('Secret for signing JWTs (min 32 chars)'),

  // Cognito
  COGNITO_REGION: z.string().default('us-east-1'),
  COGNITO_USER_POOL_ID: z.string(),
  COGNITO_CLIENT_ID: z.string(),

  // Encryption (must be exact lengths)
  ENCRYPTION_KEY: z.string().length(32),
  ENCRYPTION_IV: z.string().length(16),

  // DynamoDB (KitchenCalm/MyLife)
  DYNAMODB_REGION: z.string().default('eu-west-2'),
  DYNAMODB_TABLE_NAME: z.string(),
  DYNAMODB_ACCESS_KEY_ID: z.string(),
  DYNAMODB_SECRET_ACCESS_KEY: z.string(),
  DYNAMODB_ENDPOINT: z.string().url().optional(),

  // S3 (KitchenCalm image storage)
  S3_REGION: z.string().default('eu-west-2'),
  S3_BUCKET_NAME: z.string(),
  S3_ACCESS_KEY_ID: z.string(),
  S3_SECRET_ACCESS_KEY: z.string(),
  S3_ENDPOINT: z.string().url().optional(),

  // OpenTelemetry (optional — telemetry is disabled when endpoint is unset)
  OTEL_EXPORTER_OTLP_ENDPOINT: z.string().url().optional(),
  OTEL_EXPORTER_OTLP_HEADERS: z.string().optional(),
  OTEL_SERVICE_NAME: z.string().optional(),
});

export type Env = z.infer<typeof envSchema>;

export function validateEnv() {
  const result = envSchema.safeParse(process.env);

  if (!result.success) {
    console.error('Invalid environment variables:');
    console.error(z.treeifyError(result.error));
    process.exit(1);
  }

  const {
    DATABASE_USER,
    DATABASE_PASSWORD,
    DATABASE_HOST,
    DATABASE_PORT,
    RABBITMQ_USER,
    RABBITMQ_PASSWORD,
    RABBITMQ_HOST,
    RABBITMQ_PORT,
    ...conf
  } = result.data;

  return {
    ...conf,
    DATABASE_URL: `postgresql://${result.data.DATABASE_USER}:${result.data.DATABASE_PASSWORD}@${result.data.DATABASE_HOST}:${result.data.DATABASE_PORT}/${result.data.DATABASE_DB}`,
    RABBITMQ_URL: `amqp://${result.data.RABBITMQ_USER}:${result.data.RABBITMQ_PASSWORD}@${result.data.RABBITMQ_HOST}:${result.data.RABBITMQ_PORT}`,
  };
}
