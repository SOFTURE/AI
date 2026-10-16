import type { Attributes, Context, Link } from "@opentelemetry/api";
import { SpanKind } from "@opentelemetry/api";
import {
  AlwaysOnSampler,
  ParentBasedSampler,
  SamplingDecision,
  type Sampler,
  type SamplingResult,
} from "@opentelemetry/sdk-trace-node";

import { getPath } from "./stable-http-attributes.js";

const PATH_ATTRIBUTES = ["url.path", "http.target"] as const;

/**
 * A sampler that drops the server span of a request to one of `paths` (and with it, through `ParentBased`, every
 * span under it), and samples everything else as the SDK default does (`ParentBased(AlwaysOn)`). An entry matches
 * its own path and everything below it as whole segments: `/api/health` matches `/api/health/live`, not
 * `/api/healthz`. The query string is ignored. Throws when an entry does not start with `/`.
 */
export function createIgnorePathsSampler(paths: readonly string[]): Sampler {
  const prefixes = paths.map((path, index) => normalizePath(path, index));
  const fallback = new ParentBasedSampler({ root: new AlwaysOnSampler() });

  return {
    shouldSample(
      context: Context,
      traceId: string,
      spanName: string,
      spanKind: SpanKind,
      attributes: Attributes,
      links: Link[],
    ): SamplingResult {
      if (spanKind === SpanKind.SERVER && isIgnored(readPath(attributes), prefixes)) {
        return { decision: SamplingDecision.NOT_RECORD };
      }
      return fallback.shouldSample(context, traceId, spanName, spanKind, attributes, links);
    },
    toString: () => `IgnorePathsSampler{${prefixes.join(",")}}`,
  };
}

function normalizePath(path: string, index: number): string {
  const trimmed = path.trim();
  if (!trimmed.startsWith("/")) {
    throw new Error(`observability: traces.ignorePaths[${String(index)}] must be a path starting with /`);
  }
  // `/api/health/` and `/api/health` mean the same subtree; `/` alone keeps its slash and ignores every path.
  return trimmed.length > 1 ? trimmed.replace(/\/+$/, "") : trimmed;
}

function readPath(attributes: Attributes): string | null {
  for (const key of PATH_ATTRIBUTES) {
    const value = attributes[key];
    if (typeof value === "string" && value !== "") {
      return getPath(value);
    }
  }
  return null;
}

function isIgnored(path: string | null, prefixes: readonly string[]): boolean {
  if (path === null) {
    return false;
  }
  return prefixes.some((prefix) => prefix === "/" || path === prefix || path.startsWith(`${prefix}/`));
}
