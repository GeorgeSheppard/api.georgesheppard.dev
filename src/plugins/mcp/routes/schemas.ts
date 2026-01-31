import { z } from 'zod';

// Public Hello Endpoint
export const PublicHelloResponseSchema = z.object({
  message: z.string(),
  timestamp: z.string(),
});

export type PublicHelloResponse = z.infer<typeof PublicHelloResponseSchema>;

// Protected Hello Endpoint
export const ProtectedHelloResponseSchema = z.object({
  message: z.string(),
  userId: z.string().uuid(),
  timestamp: z.string(),
});

export type ProtectedHelloResponse = z.infer<typeof ProtectedHelloResponseSchema>;

// Error Response
export const ErrorResponseSchema = z.object({
  error: z.string(),
});

export type ErrorResponse = z.infer<typeof ErrorResponseSchema>;
