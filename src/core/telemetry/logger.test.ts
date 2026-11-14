import { describe, it, expect, vi } from 'vitest';

const emit = vi.fn();
vi.mock('@opentelemetry/api-logs', () => ({
  logs: { getLogger: () => ({ emit }), getLoggerProvider: () => ({}) },
  SeverityNumber: { INFO: 9, WARN: 13, ERROR: 17 },
}));
import { logger } from './logger.js';

describe('logger.child', () => {
  it('attaches attributes to emitted log records', () => {
    vi.spyOn(console, 'log').mockImplementation(() => {});
    logger.child({ 'engine.job_id': 'j1' }).info('hello');
    expect(emit).toHaveBeenCalledWith(
      expect.objectContaining({ body: 'hello', attributes: { 'engine.job_id': 'j1' } })
    );
  });

  it('emits no attributes from the root logger', () => {
    vi.spyOn(console, 'log').mockImplementation(() => {});
    emit.mockClear();
    logger.info('plain');
    expect(emit).toHaveBeenCalledWith(expect.objectContaining({ attributes: undefined }));
  });
});
