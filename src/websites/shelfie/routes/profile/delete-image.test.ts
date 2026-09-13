import { describe, it, expect, vi, beforeEach } from 'vitest';
import { deleteImage } from './delete-image.js';
import { createMockContext } from '@test/utils/mock-context.js';

vi.mock('../../queries/recommendations.js');
import { deleteImage as deleteImageRow } from '../../queries/recommendations.js';

function mockContext() {
  return createMockContext({ databaseClient: { db: {} } });
}

describe('deleteImage handler', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return 404 when the image does not belong to the request', async () => {
    vi.mocked(deleteImageRow).mockResolvedValue(false);

    const result = await deleteImage(mockContext(), 'request-id', 1);

    expect(result).toEqual({ status: 404, body: { error: 'Image not found', success: false } });
  });

  it('should return success when the image is deleted', async () => {
    vi.mocked(deleteImageRow).mockResolvedValue(true);

    const result = await deleteImage(mockContext(), 'request-id', 1);

    expect(deleteImageRow).toHaveBeenCalledWith({}, 1, 'request-id');
    expect(result).toEqual({ status: 200, body: { success: true } });
  });
});
