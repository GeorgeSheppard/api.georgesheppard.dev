import { logs, SeverityNumber } from '@opentelemetry/api-logs';

function emit(severity: SeverityNumber, args: unknown[]) {
  logs.getLogger('app').emit({
    severityNumber: severity,
    body: args.map((a) => (typeof a === 'string' ? a : JSON.stringify(a))).join(' '),
  });
}

export async function flushLogs() {
  const provider = logs.getLoggerProvider();
  if ('forceFlush' in provider) {
    await (provider as { forceFlush(): Promise<void> }).forceFlush().catch(() => {});
  }
}

export const logger = {
  info(...args: unknown[]) {
    console.log(...args);
    emit(SeverityNumber.INFO, args);
  },
  warn(...args: unknown[]) {
    console.warn(...args);
    emit(SeverityNumber.WARN, args);
  },
  error(...args: unknown[]) {
    console.error(...args);
    emit(SeverityNumber.ERROR, args);
  },
};
