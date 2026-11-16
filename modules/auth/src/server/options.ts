// The auth options of the running app, read from the configuration in the module context.
import { getModule, type SoftureConfig, type SoftureRuntime } from "@softure-ai/core";
import { resolveScryptParams, type AuthOptions, type ParsedAuthOptions } from "../options.js";

const MODULE_ID = "auth";

/** The enabled auth module. Throws when the app did not enable it: calling its functions then is a bug. */
export function getAuthModule(config: SoftureConfig) {
  const module = getModule(config, MODULE_ID);
  if (module === undefined) {
    throw new Error("@softure-ai/auth: the module is not enabled; add auth({ ... }) to modules in softure.config.ts");
  }
  return module;
}

/** Per parsed options object and runtime, so `getAuthOptions` returns the same object on every call. */
const resolvedOptions = new WeakMap<object, Map<SoftureRuntime, AuthOptions>>();

/** The auth options of the running app, with the hash cost resolved for its runtime (`config.platform`). */
export function getAuthOptions(config: SoftureConfig): AuthOptions {
  // The module factory parsed these options with authOptionsSchema.
  const parsed = getAuthModule(config).options as ParsedAuthOptions;
  const runtime = config.platform.runtime;
  let byRuntime = resolvedOptions.get(parsed);
  if (byRuntime === undefined) {
    byRuntime = new Map();
    resolvedOptions.set(parsed, byRuntime);
  }
  let resolved = byRuntime.get(runtime);
  if (resolved === undefined) {
    resolved = { ...parsed, password: { ...parsed.password, scrypt: resolveScryptParams(parsed.password.scrypt, runtime) } };
    byRuntime.set(runtime, resolved);
  }
  return resolved;
}

const anchoredPatterns = new WeakMap<RegExp, RegExp>();

/** `legacySession.tokenPattern` anchored to the whole token, or undefined without a legacy session. */
export function getLegacyTokenPattern(config: SoftureConfig): RegExp | undefined {
  const pattern = getAuthOptions(config).legacySession?.tokenPattern;
  if (pattern === undefined) return undefined;
  let anchored = anchoredPatterns.get(pattern);
  if (anchored === undefined) {
    // The schema refused the g and y flags, so `test` keeps no state between calls.
    anchored = new RegExp(`^(?:${pattern.source})$`, pattern.flags);
    anchoredPatterns.set(pattern, anchored);
  }
  return anchored;
}

/** The module's routes with the app's overrides applied. */
export function getAuthRoutes(config: SoftureConfig): AuthRoutes {
  const routes = getAuthModule(config).routes;
  const read = (name: keyof AuthRoutes): string => {
    const path = routes[name];
    // The manifest declares every route, so a missing one means a broken module definition.
    if (path === undefined) throw new Error(`@softure-ai/auth: route "${name}" is missing from the module manifest`);
    return path;
  };
  return {
    login: read("login"),
    register: read("register"),
    changePassword: read("changePassword"),
    forgotPassword: read("forgotPassword"),
    resetPassword: read("resetPassword"),
    afterLogin: read("afterLogin"),
    afterLogout: read("afterLogout"),
  };
}

export interface AuthRoutes {
  readonly login: string;
  readonly register: string;
  readonly changePassword: string;
  readonly forgotPassword: string;
  readonly resetPassword: string;
  readonly afterLogin: string;
  readonly afterLogout: string;
}
