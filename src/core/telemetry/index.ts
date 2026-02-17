import { NodeSDK } from '@opentelemetry/sdk-node';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-proto';
import { OTLPMetricExporter } from '@opentelemetry/exporter-metrics-otlp-proto';
import { OTLPLogExporter } from '@opentelemetry/exporter-logs-otlp-proto';
import { PeriodicExportingMetricReader } from '@opentelemetry/sdk-metrics';
import { BatchLogRecordProcessor, LoggerProvider } from '@opentelemetry/sdk-logs';
import { logs, SeverityNumber } from '@opentelemetry/api-logs';
import { config } from '@config/index.js';

export function initTelemetry(): NodeSDK | undefined {
  if (!config.OTEL_EXPORTER_OTLP_ENDPOINT) return undefined;

  // Exporters auto-read OTEL_EXPORTER_OTLP_ENDPOINT, OTEL_EXPORTER_OTLP_HEADERS,
  // and OTEL_SERVICE_NAME from standard env vars.
  const sdk = new NodeSDK({
    traceExporter: new OTLPTraceExporter(),
    metricReader: new PeriodicExportingMetricReader({
      exporter: new OTLPMetricExporter(),
      exportIntervalMillis: 60_000,
    }),
    logRecordProcessors: [new BatchLogRecordProcessor(new OTLPLogExporter())],
  });
  sdk.start();

  // Bridge console output to OTel log records
  const otelLogger = (logs.getLoggerProvider() as LoggerProvider).getLogger('console');
  for (const [method, severity] of [
    ['log', SeverityNumber.INFO],
    ['info', SeverityNumber.INFO],
    ['warn', SeverityNumber.WARN],
    ['error', SeverityNumber.ERROR],
  ] as const) {
    const original = console[method].bind(console);
    console[method] = (...args: unknown[]) => {
      original(...args);
      otelLogger.emit({
        severityNumber: severity,
        body: args.map((a) => (typeof a === 'string' ? a : JSON.stringify(a))).join(' '),
      });
    };
  }

  return sdk;
}
