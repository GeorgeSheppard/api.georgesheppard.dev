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

  // Encryption (must be exact lengths)
  ENCRYPTION_KEY: z.string().length(32),
  ENCRYPTION_IV: z.string().length(16),
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
