// The security options of the running app, read from the configuration in the module context.
import { getModule, type SoftureConfig } from "@softure-ai/core";
import { MODULE_ID } from "../index.js";
import type { RateLimitBucket, SecurityOptions } from "../options.js";

/** Throws when the app did not enable the module: calling its functions then is a bug. */
export function getSecurityOptions(config: SoftureConfig): SecurityOptions {
  const module = getModule(config, MODULE_ID);
  if (module === undefined) {
    throw new Error(`@softure-ai/security: the module is not enabled; add security({ ... }) to modules in softure.config.ts`);
  }
  // The module factory parsed these options with securityOptionsSchema.
  return module.options as SecurityOptions;
}

/** Throws on a bucket the configuration does not define: a typo in code, not a user error. */
export function getBucket(options: SecurityOptions, name: string): RateLimitBucket {
  const bucket = Object.hasOwn(options.buckets, name) ? options.buckets[name] : undefined;
  if (bucket === undefined) {
    const known = Object.keys(options.buckets).join(", ");
    throw new Error(`@softure-ai/security: unknown rate limit bucket "${name}"; configured buckets: ${known}`);
  }
  return bucket;
}
