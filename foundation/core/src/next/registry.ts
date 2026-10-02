// The config registry read by server actions and route handlers shipped in module packages
// (docs/02-module-standard.md §8). A package cannot import the app's `softure.config.ts`, so the
// app registers its config once and package code reads it here.
//
// Confirmed by identity ID-1 (`next-actions-spike`): a registration made in `softure.config.ts`,
// imported from `instrumentation.ts` and the root layout, is visible inside shipped actions, route
// handlers and pages (the layout import covers pages that `next build` prerenders).
// The value lives on `globalThis` under a `Symbol.for` key, so two copies of this file (separate
// server bundles) share one registry.
import type { SoftureConfig } from "../config.js";

const REGISTRY_KEY = Symbol.for("@softure-ai/core/config");

type RegistryHost = Record<typeof REGISTRY_KEY, SoftureConfig | undefined>;

const host = globalThis as unknown as RegistryHost;

/** Makes `config` the app's config. A later call replaces it (dev reloads re-run the config). */
export function registerSoftureConfig(config: SoftureConfig): void {
  host[REGISTRY_KEY] = config;
}

/** The registered config. Throws when the app never registered one: that is a setup bug. */
export function getSoftureConfig(): SoftureConfig {
  const config = host[REGISTRY_KEY];
  if (config === undefined) {
    throw new Error(
      "getSoftureConfig: no SOFTURE config is registered. Call registerSoftureConfig(config) in softure.config.ts " +
        "and import that file from instrumentation.ts and from the root layout.",
    );
  }
  return config;
}

/** Removes the registered config. For tests. */
export function clearSoftureConfig(): void {
  host[REGISTRY_KEY] = undefined;
}
