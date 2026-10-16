import { SpanKind } from "@opentelemetry/api";
import type { Span, SpanProcessor } from "@opentelemetry/sdk-trace-node";

// Legacy HTTP server attribute → its stable name (semantic conventions 1.23+).
const STABLE_NAMES = [
  ["http.status_code", "http.response.status_code"],
  ["http.method", "http.request.method"],
] as const;

const LEGACY_TARGET = "http.target";
const STABLE_PATH = "url.path";

/**
 * Copies the legacy HTTP server attributes Next.js still emits (`http.status_code`, `http.method`, `http.target`) onto
 * their stable names while the span is still writable, so queries on `http.response.status_code` match. The legacy
 * keys stay; a stable key the span already has is kept. `url.path` never carries the query string.
 */
export class StableHttpAttributesProcessor implements SpanProcessor {
  onStart(): void {
    // Nothing to do: Next.js sets the status code only just before the span ends.
  }

  onEnding(span: Span): void {
    if (span.kind !== SpanKind.SERVER) {
      return;
    }
    for (const [legacy, stable] of STABLE_NAMES) {
      const value = span.attributes[legacy];
      if (value !== undefined && span.attributes[stable] === undefined) {
        span.setAttribute(stable, value);
      }
    }
    const target = span.attributes[LEGACY_TARGET];
    if (typeof target === "string" && span.attributes[STABLE_PATH] === undefined) {
      span.setAttribute(STABLE_PATH, getPath(target));
    }
  }

  onEnd(): void {
    // The span is read-only here; the copy happened in onEnding.
  }

  forceFlush(): Promise<void> {
    return Promise.resolve();
  }

  shutdown(): Promise<void> {
    return Promise.resolve();
  }
}

/** The path of an `http.target`, which is a path with its query, or on some servers a full URL. */
export function getPath(target: string): string {
  try {
    // The base only makes a relative target parseable; for a full URL it is ignored.
    return new URL(target, "http://localhost").pathname;
  } catch {
    return target.split("?")[0] ?? "";
  }
}
