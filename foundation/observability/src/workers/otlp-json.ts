// OTLP/HTTP JSON bodies for log records and spans (opentelemetry-proto 1.x, JSON mapping): what the Workers entry
// sends with `fetch`, since the OpenTelemetry Node SDK and its exporters do not run in workerd. Ids are lowercase
// hex, times are nanoseconds since the epoch as decimal strings, 64-bit integers are strings.

export type OtlpAttributeValue = string | number | boolean | readonly string[] | readonly number[] | readonly boolean[];

export type OtlpLogRecord = {
  readonly scope: string;
  readonly timeUnixNano: string;
  readonly severityNumber: number;
  readonly severityText: string;
  readonly body: string;
  readonly attributes: Readonly<Record<string, OtlpAttributeValue>>;
  readonly traceId?: string;
  readonly spanId?: string;
};

/** OTLP `SpanKind`: 1 is an internal span (a scheduled run), 2 a server span. */
export const SPAN_KIND_INTERNAL = 1;
export const SPAN_KIND_SERVER = 2;
/** OTLP `StatusCode`: 0 unset, 2 error. */
export const STATUS_UNSET = 0;
export const STATUS_ERROR = 2;

export type OtlpSpan = {
  readonly scope: string;
  readonly traceId: string;
  readonly spanId: string;
  readonly parentSpanId?: string;
  readonly name: string;
  readonly kind: number;
  readonly startTimeUnixNano: string;
  readonly endTimeUnixNano: string;
  readonly attributes: Readonly<Record<string, OtlpAttributeValue>>;
  readonly statusCode: number;
};

type KeyValue = { key: string; value: AnyValue };
type AnyValue =
  | { stringValue: string }
  | { intValue: string }
  | { doubleValue: number }
  | { boolValue: boolean }
  | { arrayValue: { values: AnyValue[] } };

/** The `ExportLogsServiceRequest` body for `records`, grouped by scope under one resource. */
export function encodeLogs(resource: Readonly<Record<string, string>>, records: readonly OtlpLogRecord[]): string {
  const scopeLogs = groupByScope(records).map(([scope, items]) => ({
    scope: { name: scope },
    logRecords: items.map((record) => ({
      timeUnixNano: record.timeUnixNano,
      observedTimeUnixNano: record.timeUnixNano,
      severityNumber: record.severityNumber,
      severityText: record.severityText,
      body: { stringValue: record.body },
      attributes: encodeAttributes(record.attributes),
      ...(record.traceId === undefined ? {} : { traceId: record.traceId }),
      ...(record.spanId === undefined ? {} : { spanId: record.spanId }),
    })),
  }));
  return JSON.stringify({ resourceLogs: [{ resource: { attributes: encodeAttributes(resource) }, scopeLogs }] });
}

/** The `ExportTraceServiceRequest` body for `spans`, grouped by scope under one resource. */
export function encodeSpans(resource: Readonly<Record<string, string>>, spans: readonly OtlpSpan[]): string {
  const scopeSpans = groupByScope(spans).map(([scope, items]) => ({
    scope: { name: scope },
    spans: items.map((span) => ({
      traceId: span.traceId,
      spanId: span.spanId,
      ...(span.parentSpanId === undefined ? {} : { parentSpanId: span.parentSpanId }),
      name: span.name,
      kind: span.kind,
      startTimeUnixNano: span.startTimeUnixNano,
      endTimeUnixNano: span.endTimeUnixNano,
      attributes: encodeAttributes(span.attributes),
      status: { code: span.statusCode },
    })),
  }));
  return JSON.stringify({ resourceSpans: [{ resource: { attributes: encodeAttributes(resource) }, scopeSpans }] });
}

/** Milliseconds since the epoch as OTLP nanoseconds. */
export function toUnixNano(epochMs: number): string {
  return (BigInt(Math.round(epochMs * 1000)) * 1000n).toString();
}

function groupByScope<T extends { readonly scope: string }>(items: readonly T[]): [string, T[]][] {
  const groups = new Map<string, T[]>();
  for (const item of items) {
    const group = groups.get(item.scope);
    if (group === undefined) groups.set(item.scope, [item]);
    else group.push(item);
  }
  return [...groups];
}

function encodeAttributes(attributes: Readonly<Record<string, OtlpAttributeValue>>): KeyValue[] {
  return Object.entries(attributes).map(([key, value]) => ({ key, value: encodeValue(value) }));
}

function encodeValue(value: OtlpAttributeValue): AnyValue {
  if (Array.isArray(value)) {
    return { arrayValue: { values: (value as readonly (string | number | boolean)[]).map((item) => encodeValue(item)) } };
  }
  if (typeof value === "string") return { stringValue: value };
  if (typeof value === "boolean") return { boolValue: value };
  if (typeof value === "number") return Number.isSafeInteger(value) ? { intValue: String(value) } : { doubleValue: value };
  return { stringValue: String(value) };
}
