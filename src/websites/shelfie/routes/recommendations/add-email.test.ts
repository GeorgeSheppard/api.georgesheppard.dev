import { describe, it, expect, vi, beforeEach } from 'vitest';
import { addEmail } from './add-email.js';
import { createMockContext } from '@test/utils/mock-context.js';

vi.mock('../../queries/recommendations.js');
vi.mock('@core/utils/encryption.js');

import {
  findRecommendationById,
  findRequestById,
  updateRequestEmailFields,
} from '../../queries/recommendations.js';
import { encryption } from '@core/utils/encryption.js';

const mockSendRecommendationsEmail = vi.fn();

function mockContext() {
  return createMockContext({
    databaseClient: { db: {} },
    emailClient: { sendRecommendationsEmail: mockSendRecommendationsEmail },
  });
}

describe('addEmail handler', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(encryption.encrypt).mockReturnValue('encrypted-value');
    vi.mocked(encryption.decrypt).mockReturnValue('decrypted@example.com');
  });

  describe('not found (404)', () => {
    it('should return 404 when recommendation does not exist', async () => {
      vi.mocked(findRecommendationById).mockResolvedValue(null);

      const result = await addEmail(mockContext(), { id: 'non-existent-id' });

      expect(result).toEqual({
        status: 404,
        body: { error: 'Recommendation not found', success: false },
      });
    });
  });

  describe('bad request (400)', () => {
    it('should return 400 when no email provided and none on request', async () => {
      vi.mocked(findRecommendationById).mockResolvedValue({
        id: 'rec-1',
        requestId: 'req-1',
        recommendations: null,
        processedUtc: null,
      });
      vi.mocked(findRequestById).mockResolvedValue({ id: 'req-1', email: null });

      const result = await addEmail(mockContext(), { id: 'rec-1' });

      expect(result).toEqual({
        status: 400,
        body: { error: 'No email provided', success: false },
      });
    });
  });

  describe('success (200)', () => {
    it('should use provided email directly', async () => {
      vi.mocked(findRecommendationById).mockResolvedValue({
        id: 'rec-1',
        requestId: 'req-1',
        recommendations: null,
        processedUtc: null,
      });
      vi.mocked(findRequestById).mockResolvedValue({ id: 'req-1', email: null });

      const result = await addEmail(mockContext(), { id: 'rec-1', email: 'test@example.com' });

      expect(result).toEqual({ status: 200, body: { success: true } });
      expect(encryption.encrypt).toHaveBeenCalledWith('test@example.com');
      expect(updateRequestEmailFields).toHaveBeenCalledWith({}, 'req-1', {
        email: 'encrypted-value',
        frequency: null,
        nextRecommendationUtc: null,
      });
    });

    it('should decrypt existing email when none provided', async () => {
      vi.mocked(findRecommendationById).mockResolvedValue({
        id: 'rec-1',
        requestId: 'req-1',
        recommendations: null,
        processedUtc: null,
      });
      vi.mocked(findRequestById).mockResolvedValue({ id: 'req-1', email: 'encrypted-stored' });

      const result = await addEmail(mockContext(), { id: 'rec-1' });

      expect(result.status).toBe(200);
      expect(encryption.decrypt).toHaveBeenCalledWith('encrypted-stored');
      expect(encryption.encrypt).toHaveBeenCalledWith('decrypted@example.com');
    });

    it('should set recurring fields when recurring is true', async () => {
      vi.mocked(findRecommendationById).mockResolvedValue({
        id: 'rec-1',
        requestId: 'req-1',
        recommendations: null,
        processedUtc: null,
      });
      vi.mocked(findRequestById).mockResolvedValue({ id: 'req-1', email: null });

      await addEmail(mockContext(), { id: 'rec-1', email: 'test@example.com', recurring: true });

      expect(updateRequestEmailFields).toHaveBeenCalledWith(
        {},
        'req-1',
        expect.objectContaining({
          email: 'encrypted-value',
          frequency: 'M',
          nextRecommendationUtc: expect.any(Date),
        })
      );
    });

    it('should not store email when recommendations already done and not recurring', async () => {
      vi.mocked(findRecommendationById).mockResolvedValue({
        id: 'rec-1',
        requestId: 'req-1',
        recommendations: [
          {
            name: 'Book',
            author: 'Author',
            description: 'Desc',
            reason: 'Reason',
            amazonLink: 'link',
          },
        ],
        processedUtc: new Date(),
      });
      vi.mocked(findRequestById).mockResolvedValue({ id: 'req-1', email: null });

      await addEmail(mockContext(), { id: 'rec-1', email: 'test@example.com', recurring: false });

      expect(updateRequestEmailFields).toHaveBeenCalledWith(
        {},
        'req-1',
        expect.objectContaining({
          email: null,
          frequency: null,
        })
      );
    });

    it('should send email immediately when recommendations are already done', async () => {
      vi.mocked(findRecommendationById).mockResolvedValue({
        id: 'rec-1',
        requestId: 'req-1',
        recommendations: [
          {
            name: 'Book',
            author: 'Author',
            description: 'Desc',
            reason: 'Reason',
            amazonLink: 'link',
          },
        ],
        processedUtc: new Date(),
      });
      vi.mocked(findRequestById).mockResolvedValue({ id: 'req-1', email: null });
      mockSendRecommendationsEmail.mockResolvedValue(undefined);

      const result = await addEmail(mockContext(), { id: 'rec-1', email: 'test@example.com' });

      expect(result.status).toBe(200);
      expect(mockSendRecommendationsEmail).toHaveBeenCalledWith(
        expect.objectContaining({
          to: ['test@example.com'],
          template: 'shelfie recommendations',
        })
      );
    });

    it('should still return 200 when email sending fails', async () => {
      vi.mocked(findRecommendationById).mockResolvedValue({
        id: 'rec-1',
        requestId: 'req-1',
        recommendations: [
          {
            name: 'Book',
            author: 'Author',
            description: 'Desc',
            reason: 'Reason',
            amazonLink: 'link',
          },
        ],
        processedUtc: new Date(),
      });
      vi.mocked(findRequestById).mockResolvedValue({ id: 'req-1', email: null });
      mockSendRecommendationsEmail.mockRejectedValue(new Error('SMTP error'));

      const result = await addEmail(mockContext(), { id: 'rec-1', email: 'test@example.com' });

      expect(result.status).toBe(200);
    });

    it('should not send email when recommendations are not yet done', async () => {
      vi.mocked(findRecommendationById).mockResolvedValue({
        id: 'rec-1',
        requestId: 'req-1',
        recommendations: null,
        processedUtc: null,
      });
      vi.mocked(findRequestById).mockResolvedValue({ id: 'req-1', email: null });

      await addEmail(mockContext(), { id: 'rec-1', email: 'test@example.com' });

      expect(mockSendRecommendationsEmail).not.toHaveBeenCalled();
    });
  });
});
