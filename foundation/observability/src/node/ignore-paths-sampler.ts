import { SpanKind, type Attributes, type Context, type Link } from "@opentelemetry/api";
import {
  AlwaysOnSampler,
  ParentBasedSampler,
  SamplingDecision,
  type Sampler,
  type SamplingResult,
} from "@opentelemetry/sdk-trace";

import { isIgnoredPath as isIgnored, normalizeIgnoredPaths as normalizePaths } from "../ignored-paths.js";
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

export { createIgnoredPathMatcher } from "../ignored-paths.js";

function readPath(attributes: Attributes): string | null {
  for (const key of PATH_ATTRIBUTES) {
    const value = attributes[key];
    if (typeof value === "string" && value !== "") {
      return getPath(value);
    }
  }
  return null;
}
