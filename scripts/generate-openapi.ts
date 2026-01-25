// Load test environment BEFORE any other imports
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.test' });

// Now dynamically import everything else after env is loaded
async function main() {
  const { OpenAPIHono } = await import('@hono/zod-openapi');
  const fs = await import('fs');
  const path = await import('path');
  const { fileURLToPath } = await import('url');
  const { registerShelfieRoutes } = await import('../src/websites/shelfie/routes/index.js');

  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);

  const OUTPUT_DIR = path.resolve(__dirname, '../generated/openapi');

  // Ensure output directory exists
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }

  const app = new OpenAPIHono();

  // Register all website routes
  registerShelfieRoutes(app);

  // Generate the spec
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
