import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().default(3000),

  // Database
  DATABASE_URL: z.string().url(),

  // RabbitMQ
  RABBITMQ_URL: z.string().url(),

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

export function validateEnv(): Env {
  const result = envSchema.safeParse(process.env);

  if (!result.success) {
    console.error('Invalid environment variables:');
    console.error(z.treeifyError(result.error));
    process.exit(1);
  }

  return result.data;
}
