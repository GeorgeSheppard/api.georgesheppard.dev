import { OpenAPIHono } from '@hono/zod-openapi';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { swaggerUI } from '@hono/swagger-ui';
import { securityHeaders } from '@core/middleware/security.js';
import { errorHandler } from '@core/middleware/error-handler.js';
import { QueueClient } from '@core/queue/client.js';
import { DatabaseClient } from '@core/database/client.js';
import { DynamoDBClientWrapper } from '@core/database/dynamodb-client.js';
import { S3ClientWrapper } from '@core/storage/s3-client.js';
import { registerShelfieRoutes } from '@websites/shelfie/routes/index.js';
import { registerKitchenCalmRoutes } from '@websites/kitchencalm/routes/index.js';
import { config } from "./config";
import { Env } from "hono/types";
import { EmailClient } from "@core/utils/mailgun";
import { IpLocator } from "@core/utils/ip-locator";
import { CognitoUser } from "@core/middleware/cognito-auth.js";

export type App = OpenAPIHono<Env, {}, "/">

export async function createApp(
  databaseClient: DatabaseClient,
  queueClient: QueueClient,
  emailClient: EmailClient,
  ipLocator: IpLocator,
  dynamoDBClient: DynamoDBClientWrapper,
  s3Client: S3ClientWrapper
) {
  const app = new OpenAPIHono();


  // Store clients in app context
  app.use('*', async (c, next) => {
    c.set('queueClient', queueClient);
    c.set('databaseClient', databaseClient);
    c.set('emailClient', emailClient)
    c.set('ipLocator', ipLocator)
    c.set('dynamoDBClient', dynamoDBClient)
    c.set('s3Client', s3Client)
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

  // Register routes
  registerShelfieRoutes(app);
  registerKitchenCalmRoutes(app);

  // OpenAPI documentation
  app.doc('/swagger/json', {
    openapi: '3.0.0',
    info: {
      title: 'Multi-Site API',
      description: 'API for Shelfie (book recommendations) and KitchenCalm (recipe management)',
      version: '2.0.0',
    },
    servers: [
      { url: `http://localhost:${config.PORT}`, description: 'Development' },
      { url: 'https://api.georgesheppard.dev', description: 'Production' },
    ],
  });

  // Register Swagger UI
  app.get('/swagger', swaggerUI({ url: '/swagger/json' }));

  return app;
}

// Type augmentation for context
declare module 'hono' {
  interface ContextVariableMap {
    queueClient: QueueClient;
    databaseClient: DatabaseClient;
    emailClient: EmailClient;
    ipLocator: IpLocator;
    dynamoDBClient: DynamoDBClientWrapper;
    s3Client: S3ClientWrapper;
    cognitoUser: CognitoUser | null;
  }
}
