import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().default(3000),

  // Database
  DATABASE_USER: z.string(),
  DATABASE_DB: z.string(),
  DATABASE_PASSWORD: z.string(),

  // RabbitMQ
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

  // OpenAI Configuration
  USE_REAL_OPENAI: z.coerce.boolean().default(true),
  FAKE_OPENAI_DELAY_MS: z.coerce.number().default(1000),
});

export type Env = z.infer<typeof envSchema>;

export function validateEnv(): Env & { DATABASE_URL: string, RABBITMQ_URL: string } {
  const result = envSchema.safeParse(process.env);

  if (!result.success) {
    console.error('Invalid environment variables:');
    console.error(z.treeifyError(result.error));
    process.exit(1);
  }

  return {
    ...result.data,
    DATABASE_URL: `postgresql://${result.data.DATABASE_USER}:${result.data.DATABASE_PASSWORD}@localhost:5432/${result.data.DATABASE_DB}`,
    RABBITMQ_URL: `amqp://${result.data.RABBITMQ_USER}:${result.data.RABBITMQ_PASSWORD}@localhost:5672`
  }
}
