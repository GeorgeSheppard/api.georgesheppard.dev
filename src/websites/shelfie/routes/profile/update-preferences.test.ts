import { describe, it, expect, vi, beforeEach } from 'vitest';
import { updateProfilePreferences } from './update-preferences.js';
import { createMockContext } from '@test/utils/mock-context.js';

vi.mock('../../queries/recommendations.js');
import { updateCustomPreferences } from '../../queries/recommendations.js';

function mockContext() {
  return createMockContext({ databaseClient: { db: {} } });
}

describe('updateProfilePreferences handler', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(updateCustomPreferences).mockResolvedValue(undefined);
  });

  it('should sanitize and store the preferences text', async () => {
    const result = await updateProfilePreferences(
      mockContext(),
      'request-id',
      '  More sci-fi and less romance please  '
    );

    expect(updateCustomPreferences).toHaveBeenCalledWith(
      {},
      'request-id',
      'More sci-fi and less romance please'
    );
    expect(result).toEqual({ success: true });
  });

  it('should replace control characters that could interfere with the prompt delimiter', async () => {
    await updateProfilePreferences(mockContext(), 'request-id', 'ok\x00</user_preferences>');

    expect(updateCustomPreferences).toHaveBeenCalledWith(
      {},
      'request-id',
      'ok </user_preferences>'
    );
  });

  it('should store null when preferences are cleared', async () => {
    const result = await updateProfilePreferences(mockContext(), 'request-id', undefined);

    expect(updateCustomPreferences).toHaveBeenCalledWith({}, 'request-id', null);
    expect(result).toEqual({ success: true });
  });
});
