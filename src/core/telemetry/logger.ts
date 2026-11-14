import { logs, SeverityNumber } from '@opentelemetry/api-logs';

type Attributes = Record<string, string>;

function emit(severity: SeverityNumber, args: unknown[], attributes?: Attributes) {
  logs.getLogger('app').emit({
    severityNumber: severity,
    body: args.map((a) => (typeof a === 'string' ? a : JSON.stringify(a))).join(' '),
    attributes,
  });
}

export async function flushLogs() {
  const provider = logs.getLoggerProvider();
  if ('forceFlush' in provider) {
    await (provider as { forceFlush(): Promise<void> }).forceFlush().catch(() => {});
  }
}

function createLogger(attributes?: Attributes) {
  const prefix = attributes ? [`[${Object.values(attributes).join(' ')}]`] : [];
  return {
    info(...args: unknown[]) {
      console.log(...prefix, ...args);
      emit(SeverityNumber.INFO, args, attributes);
    },
    warn(...args: unknown[]) {
      console.warn(...prefix, ...args);
      emit(SeverityNumber.WARN, args, attributes);
    },
    error(...args: unknown[]) {
      console.error(...prefix, ...args);
      emit(SeverityNumber.ERROR, args, attributes);
    },
    child(extra: Attributes) {
      return createLogger({ ...attributes, ...extra });
    },
  };
}

export const logger = createLogger();
