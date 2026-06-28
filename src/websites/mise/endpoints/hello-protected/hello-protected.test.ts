import { describe, it, expect, vi } from 'vitest';
import { helloProtected } from './hello-protected.js';
import type { ContextWithUserId } from '@core/types/context.js';

const validUserId = '550e8400-e29b-41d4-a716-446655440000';
const anotherUserId = '550e8400-e29b-41d4-a716-446655440001';

describe('helloProtected handler', () => {
  describe('Success cases', () => {
    it('should return message, userId, and timestamp', async () => {
      const mockContext = {
        get: vi.fn().mockReturnValue(validUserId),
      } as unknown as ContextWithUserId;

      const result = await helloProtected(mockContext);

      expect(result).toHaveProperty('message');
      expect(result).toHaveProperty('userId');
      expect(result).toHaveProperty('timestamp');
      expect(result.userId).toBe(validUserId);
      expect(typeof result.message).toBe('string');
      expect(typeof result.timestamp).toBe('string');
    });

    it('should return the userId from context', async () => {
      const mockContext = {
        get: vi.fn().mockReturnValue(anotherUserId),
      } as unknown as ContextWithUserId;

      const result = await helloProtected(mockContext);

      expect(result.userId).toBe(anotherUserId);
    });

    it('should return valid ISO timestamp', async () => {
      const mockContext = {
        get: vi.fn().mockReturnValue(validUserId),
      } as unknown as ContextWithUserId;

      const result = await helloProtected(mockContext);

      const timestamp = new Date(result.timestamp);
      expect(timestamp.getTime()).toBeGreaterThan(0);
      expect(result.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
    });

    it('should include expected message text', async () => {
      const mockContext = {
        get: vi.fn().mockReturnValue(validUserId),
      } as unknown as ContextWithUserId;

      const result = await helloProtected(mockContext);

      expect(result.message).toBe('Hello from protected endpoint!');
    });

    it('should call context.get with userId key', async () => {
      const mockGet = vi.fn().mockReturnValue(validUserId);
      const mockContext = {
        get: mockGet,
      } as unknown as ContextWithUserId;

      await helloProtected(mockContext);

      expect(mockGet).toHaveBeenCalledWith('userId');
    });
  });

  describe('Different user IDs', () => {
    it('should handle different user IDs correctly', async () => {
      const testUserId = '123e4567-e89b-12d3-a456-426614174000';
      const mockContext = {
        get: vi.fn().mockReturnValue(testUserId),
      } as unknown as ContextWithUserId;

      const result = await helloProtected(mockContext);

      expect(result.userId).toBe(testUserId);
    });

    it('should return current timestamp each time', async () => {
      const mockContext = {
        get: vi.fn().mockReturnValue(validUserId),
      } as unknown as ContextWithUserId;

      const before = new Date();
      const result = await helloProtected(mockContext);
      const after = new Date();

      const resultTime = new Date(result.timestamp);
      expect(resultTime.getTime()).toBeGreaterThanOrEqual(before.getTime());
      expect(resultTime.getTime()).toBeLessThanOrEqual(after.getTime());
    });
  });
});
