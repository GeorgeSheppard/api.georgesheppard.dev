import { ErrorHandler } from 'hono';
import z, { ZodError } from 'zod';
import { logger } from '@core/telemetry/logger.js';

export const errorHandler: ErrorHandler = (error, c) => {
  logger.error('Error occurred:', {
    method: c.req.method,
    url: c.req.url,
    error: error.message,
    errorType: error.constructor.name,
    stack: error.stack,
  });
  // Handle Zod validation errors
  if (error instanceof ZodError) {
    return c.json(
      {
        error: 'Validation failed',
        details: z.treeifyError(error),
      },
      400
    );
  }

  // Handle errors with statusCode property (includes Hono validation errors)
  const statusCode = (error as any).statusCode || (error as any).status || 500;
  const message = statusCode === 500 ? 'Internal server error' : error.message;

  return c.json(
    {
      error: message,
    },
    statusCode
  );
};
