import { OpenAPIHono } from '@hono/zod-openapi';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { swaggerUI } from '@hono/swagger-ui';
import { securityHeaders } from '@core/middleware/security.js';
import { errorHandler } from '@core/middleware/error-handler.js';
import { QueueClient } from '@core/queue/client.js';
import { DatabaseClient } from '@core/database/client.js';
import { DynamoDBClientWrapper } from '@core/dynamodb/client.js';
import { S3ClientWrapper } from '@core/s3/client.js';
import { registerShelfieRoutes } from '@websites/shelfie/index.js';
import {
  registerRoutes as registerKitchenCalmRoutes,
  tools as kitchenCalmTools,
} from '@websites/kitchencalm/index.js';
import { registerMcpSseRoute } from '@core/mcp/sse.js';
import { config } from './config';
import { Env } from 'hono/types';
import { EmailClient } from '@core/utils/mailgun';
import { IpLocator } from '@core/utils/ip-locator';

export type App = OpenAPIHono<Env, {}, '/'>;

export interface AppDependencies {
  databaseClient: DatabaseClient;
  queueClient: QueueClient;
  emailClient: EmailClient;
  ipLocator: IpLocator;
  dynamoClient: DynamoDBClientWrapper;
  s3Client: S3ClientWrapper;
}

export async function createApp(dependencies: AppDependencies) {
  const { databaseClient, queueClient, emailClient, ipLocator, dynamoClient, s3Client } =
    dependencies;
  const app = new OpenAPIHono();

  // Store clients in app context
  app.use('*', async (c, next) => {
    c.set('queueClient', queueClient);
    c.set('databaseClient', databaseClient);
    c.set('emailClient', emailClient);
    c.set('ipLocator', ipLocator);
    c.set('dynamoClient', dynamoClient);
    c.set('s3Client', s3Client);
    await next();
  });

  // Middleware registration
  app.use('*', logger());
  app.use('*', securityHeaders());
  app.use('*', cors({ origin: '*' }));
  // Error handler must be registered after middleware
  app.onError(errorHandler);

  // Health check
  app.get('/health', (c) => {
    return c.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  // Register website routes
  registerShelfieRoutes(app);
  registerKitchenCalmRoutes(app);

  // Register MCP with all tools from all websites
  const allMcpTools = [...kitchenCalmTools];
  registerMcpSseRoute(app, allMcpTools);

  // Register Swagger UI and OpenAPI spec
  if (config.NODE_ENV === 'development') {
    app.doc('/swagger/json', {
      openapi: '3.0.0',
      info: {
        title: 'Shelfie API',
        description: 'Book recommendation API for Shelfie',
        version: '2.0.0',
      },
      servers: [
        { url: `http://localhost:${config.PORT}`, description: 'Development' },
        { url: 'https://api.georgesheppard.dev', description: 'Production' },
      ],
    });
    app.get('/swagger', swaggerUI({ url: '/swagger/json' }));
  }

  return app;
}

// Type augmentation for context
declare module 'hono' {
  interface ContextVariableMap {
    queueClient: QueueClient;
    databaseClient: DatabaseClient;
    emailClient: EmailClient;
    ipLocator: IpLocator;
    dynamoClient: DynamoDBClientWrapper;
    s3Client: S3ClientWrapper;
  }
}
