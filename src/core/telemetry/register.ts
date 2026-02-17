import { NodeSDK } from '@opentelemetry/sdk-node';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-proto';
import { OTLPMetricExporter } from '@opentelemetry/exporter-metrics-otlp-proto';
import { OTLPLogExporter } from '@opentelemetry/exporter-logs-otlp-proto';
import { HttpInstrumentation } from '@opentelemetry/instrumentation-http';
import { PeriodicExportingMetricReader } from '@opentelemetry/sdk-metrics';
import { BatchLogRecordProcessor, LoggerProvider } from '@opentelemetry/sdk-logs';
import { logs, SeverityNumber } from '@opentelemetry/api-logs';
import { resourceFromAttributes } from '@opentelemetry/resources';
import { ATTR_SERVICE_NAME } from '@opentelemetry/semantic-conventions';
import { config } from '../../config/index.js';

if (config.OTEL_EXPORTER_OTLP_ENDPOINT) {
  const endpoint = config.OTEL_EXPORTER_OTLP_ENDPOINT;
  const headers = parseHeaders(config.OTEL_EXPORTER_OTLP_HEADERS);
  const serviceName = config.OTEL_SERVICE_NAME ?? 'api-georgesheppard';

  const resource = resourceFromAttributes({ [ATTR_SERVICE_NAME]: serviceName });

  const traceExporter = new OTLPTraceExporter({
    url: `${endpoint}/v1/traces`,
    headers,
  });

  const metricExporter = new OTLPMetricExporter({
    url: `${endpoint}/v1/metrics`,
    headers,
  });

  const logExporter = new OTLPLogExporter({
    url: `${endpoint}/v1/logs`,
    headers,
  });

  const logRecordProcessor = new BatchLogRecordProcessor(logExporter);

  const sdk = new NodeSDK({
    resource,
    traceExporter,
    metricReader: new PeriodicExportingMetricReader({
      exporter: metricExporter,
      exportIntervalMillis: 60_000,
    }),
    logRecordProcessors: [logRecordProcessor],
    instrumentations: [new HttpInstrumentation()],
  });

  sdk.start();

  // Bridge console methods to OTel log records
  const loggerProvider = logs.getLoggerProvider() as LoggerProvider;
  const otelLogger = loggerProvider.getLogger('console');

  const wrap = (original: (...args: unknown[]) => void, severity: SeverityNumber) => {
    return (...logArgs: unknown[]) => {
      original(...logArgs);
      otelLogger.emit({
        severityNumber: severity,
        body: logArgs.map((a) => (typeof a === 'string' ? a : JSON.stringify(a))).join(' '),
      });
    };
  };

  console.log = wrap(console.log.bind(console), SeverityNumber.INFO);
  console.info = wrap(console.info.bind(console), SeverityNumber.INFO);
  console.warn = wrap(console.warn.bind(console), SeverityNumber.WARN);
  console.error = wrap(console.error.bind(console), SeverityNumber.ERROR);

  const shutdown = async () => {
    await sdk.shutdown();
  };

  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}

function parseHeaders(raw: string | undefined): Record<string, string> {
  if (!raw) return {};
  const headers: Record<string, string> = {};
  for (const pair of raw.split(',')) {
    const idx = pair.indexOf('=');
    if (idx > 0) {
      headers[pair.slice(0, idx).trim()] = pair.slice(idx + 1).trim();
    }
  }
  return headers;
}
