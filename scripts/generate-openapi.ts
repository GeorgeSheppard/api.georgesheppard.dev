import { config } from 'dotenv';
import fs from 'fs';
import path from 'path';
import { createTestApp } from 'test/utils/app.js';
import { fileURLToPath } from 'url';

config({ path: '.env.test' });

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const OUTPUT_DIR = path.resolve(__dirname, '../generated/openapi');

if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

const app = await createTestApp({});
const spec = app.getOpenAPIDocument({
  openapi: '3.0.0',
  info: {
    title: 'API',
    description: 'Backend API for georgesheppard.dev websites',
    version: '1.0.0',
  },
  servers: [{ url: 'https://api.georgesheppard.dev', description: 'Production' }],
});

const outputPath = path.join(OUTPUT_DIR, 'georgesheppard-spec.json');
fs.writeFileSync(outputPath, JSON.stringify(spec, null, 2) + '\n');
console.log(`Generated: ${outputPath}`);
