// Set dummy env vars for config validation - no .env file needed
// These are never used, just satisfy the validator during import
process.env.PORT = '3000';
process.env.DATABASE_HOST = 'localhost';
process.env.DATABASE_PORT = '5432';
process.env.DATABASE_USER = 'user';
process.env.DATABASE_DB = 'db';
process.env.DATABASE_PASSWORD = 'pass';
process.env.DATABASE_MIGRATIONS_PATH = './migrations';
process.env.RABBITMQ_HOST = 'localhost';
process.env.RABBITMQ_PORT = '5672';
process.env.RABBITMQ_USER = 'user';
process.env.RABBITMQ_PASSWORD = 'pass';
process.env.API_KEY = 'key';
process.env.MAILGUN_API_KEY = 'key';
process.env.OPENAI_API_KEY = 'key';
process.env.TEXT_EXTRACTOR_URL = 'http://localhost';
process.env.ENCRYPTION_KEY = '12345678901234567890123456789012';
process.env.ENCRYPTION_IV = '1234567890123456';

async function main() {
  const { OpenAPIHono } = await import('@hono/zod-openapi');
  const fs = await import('fs');
  const path = await import('path');
  const { fileURLToPath } = await import('url');
  const { registerShelfieRoutes } = await import('../src/websites/shelfie/routes/index.js');

  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);
  const OUTPUT_DIR = path.resolve(__dirname, '../generated/openapi');

  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }

  const app = new OpenAPIHono();
  registerShelfieRoutes(app);

  const spec = app.getOpenAPIDocument({
    openapi: '3.0.0',
    info: {
      title: 'API',
      description: 'Backend API for georgesheppard.dev websites',
      version: '1.0.0',
    },
    servers: [{ url: 'https://api.georgesheppard.dev', description: 'Production' }],
  });

  const outputPath = path.join(OUTPUT_DIR, 'api.json');
  fs.writeFileSync(outputPath, JSON.stringify(spec, null, 2));
  console.log(`Generated: ${outputPath}`);
}

main();
