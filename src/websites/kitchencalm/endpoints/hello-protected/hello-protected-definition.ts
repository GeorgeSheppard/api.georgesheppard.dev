import { z } from 'zod';

export const HelloProtectedResponseSchema = z.object({
  message: z.string(),
  userId: z.string().uuid(),
  timestamp: z.string(),
});

export type HelloProtectedResponse = z.infer<typeof HelloProtectedResponseSchema>;
