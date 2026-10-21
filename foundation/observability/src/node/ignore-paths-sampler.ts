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
  const prefixes = normalizePaths(paths);
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

/**
 * Whether a request target (a path with its query, or a full URL) is one of `paths` or below one, by the rules of
 * `createIgnorePathsSampler`. Throws when an entry does not start with `/`.
 */
export function createIgnoredPathMatcher(paths: readonly string[]): (target: string) => boolean {
  const prefixes = normalizePaths(paths);
  return (target) => isIgnored(getPath(target), prefixes);
}

function normalizePaths(paths: readonly string[]): string[] {
  return paths.map((path, index) => normalizePath(path, index));
}

function normalizePath(path: string, index: number): string {
  const trimmed = path.trim();
  if (!trimmed.startsWith("/")) {
    throw new Error(`observability: traces.ignorePaths[${String(index)}] must be a path starting with /`);
  }
  // `/api/health/` and `/api/health` mean the same subtree; `/` alone keeps its slash and ignores every path.
  return trimmed.length > 1 ? dropTrailingSlashes(trimmed) : trimmed;
}

// A loop, not `/\/+$/`: that regular expression backtracks polynomially on a run of slashes.
function dropTrailingSlashes(path: string): string {
  let end = path.length;
  while (end > 1 && path[end - 1] === "/") {
    end -= 1;
  }
  return path.slice(0, end);
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
