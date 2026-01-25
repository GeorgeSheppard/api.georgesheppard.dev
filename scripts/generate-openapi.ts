// Set dummy environment variables before any imports that might validate them
// This script only needs route definitions for OpenAPI spec, not actual connections
process.env.NODE_ENV = 'development';
process.env.PORT = '3000';
process.env.DATABASE_HOST = 'localhost';
process.env.DATABASE_PORT = '5432';
process.env.DATABASE_USER = 'user';
process.env.DATABASE_DB = 'db';
process.env.DATABASE_PASSWORD = 'password';
process.env.DATABASE_MIGRATIONS_PATH = './migrations';
process.env.RABBITMQ_HOST = 'localhost';
process.env.RABBITMQ_PORT = '5672';
process.env.RABBITMQ_USER = 'user';
process.env.RABBITMQ_PASSWORD = 'password';
process.env.API_KEY = 'dummy-api-key';
process.env.MAILGUN_API_KEY = 'dummy-mailgun-key';
process.env.OPENAI_API_KEY = 'dummy-openai-key';
process.env.TEXT_EXTRACTOR_URL = 'http://localhost:8080';
process.env.ENCRYPTION_KEY = '12345678901234567890123456789012';
process.env.ENCRYPTION_IV = '1234567890123456';

import { OpenAPIHono } from '@hono/zod-openapi';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

interface OpenAPIConfig {
  title: string;
  description: string;
  version: string;
  servers?: Array<{ url: string; description: string }>;
}

interface WebsiteModule {
  registerRoutes: (app: OpenAPIHono) => void;
  openapiConfig: OpenAPIConfig;
}

async function generateOpenAPISpecs() {
  const websitesDir = path.resolve(__dirname, '../src/websites');
  const outputDir = path.resolve(__dirname, '../generated/openapi');

  // Ensure output directory exists
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  // Get all website directories
  const websiteFolders = fs
    .readdirSync(websitesDir, { withFileTypes: true })
    .filter((dirent) => dirent.isDirectory())
    .map((dirent) => dirent.name);

  console.log(`Found ${websiteFolders.length} website(s): ${websiteFolders.join(', ')}`);

  for (const websiteName of websiteFolders) {
    console.log(`\nGenerating OpenAPI spec for: ${websiteName}`);

    try {
      // Dynamically import the website's routes module
      const modulePath = path.resolve(websitesDir, websiteName, 'routes/index.js');

      // Check if routes/index.ts exists (we check .ts for existence, import .js for ESM)
      const tsPath = modulePath.replace('.js', '.ts');
      if (!fs.existsSync(tsPath)) {
        console.warn(`  Skipping ${websiteName}: No routes/index.ts found`);
        continue;
      }

      const websiteModule = (await import(modulePath)) as WebsiteModule;

      // Validate module exports
      if (!websiteModule.registerRoutes) {
        console.warn(`  Skipping ${websiteName}: No registerRoutes function exported`);
        continue;
      }

      if (!websiteModule.openapiConfig) {
        console.warn(`  Skipping ${websiteName}: No openapiConfig exported`);
        continue;
      }

      const { registerRoutes, openapiConfig } = websiteModule;

      // Create a fresh Hono app for this website
      const app = new OpenAPIHono();

      // Register the website's routes
      registerRoutes(app);

      // Generate OpenAPI document
      const spec = app.getOpenAPIDocument({
        openapi: '3.0.0',
        info: {
          title: openapiConfig.title,
          description: openapiConfig.description,
          version: openapiConfig.version,
        },
        servers: openapiConfig.servers ?? [
          { url: 'https://api.georgesheppard.dev', description: 'Production' },
        ],
      });

      // Write the spec to a file
      const outputPath = path.join(outputDir, `${websiteName}.json`);
      fs.writeFileSync(outputPath, JSON.stringify(spec, null, 2));

      console.log(`  Generated: ${outputPath}`);
    } catch (error) {
      console.error(`  Error generating spec for ${websiteName}:`, error);
    }
  }

  console.log('\nOpenAPI spec generation complete!');
}

generateOpenAPISpecs().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
