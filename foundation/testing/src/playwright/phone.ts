import { expect, type BrowserContext, type Page } from "@playwright/test";
import { openChromiumSession } from "./cdp.js";

export interface NetworkProfile {
  /** Round trip added to every request, in milliseconds. */
  latencyMs: number;
  /** Bytes per second. */
  downloadThroughput: number;
  /** Bytes per second. */
  uploadThroughput: number;
}

/** The phone networks as Chrome DevTools defines them (its "Fast 4G" and "Slow 4G" presets). */
export const PHONE_NETWORK_PROFILES = {
  FAST_4G: { latencyMs: 60 * 2.75, downloadThroughput: ((9 * 1000 * 1000) / 8) * 0.9, uploadThroughput: ((1.5 * 1000 * 1000) / 8) * 0.9 },
  SLOW_4G: { latencyMs: 150 * 3.75, downloadThroughput: ((1.6 * 1000 * 1000) / 8) * 0.9, uploadThroughput: ((750 * 1000) / 8) * 0.9 },
} as const satisfies Record<string, NetworkProfile>;

export type PhoneNetworkName = keyof typeof PHONE_NETWORK_PROFILES;

/** How much slower a mid-range phone's CPU is than a desktop's, as Lighthouse's mobile run assumes. */
export const PHONE_CPU_SLOWDOWN = 4;

export interface ThrottleLikePhoneOptions {
  /** CPU slowdown factor. Default: `PHONE_CPU_SLOWDOWN`. */
  cpuSlowdown?: number;
}

export interface PhoneThrottle {
  /** Gives the page its full network and CPU back. */
  release(): Promise<void>;
}

/**
 * Throttles the page's network and CPU like a phone (default `SLOW_4G` and a 4× slower CPU). Chromium
 * only (CDP). `context` must be the page's context; it is named so a call reads like the setup it is.
 */
export async function throttleLikePhone(
  context: BrowserContext,
  page: Page,
  profile: PhoneNetworkName | NetworkProfile = "SLOW_4G",
  options: ThrottleLikePhoneOptions = {},
): Promise<PhoneThrottle> {
  if (page.context() !== context) throw new Error("throttleLikePhone: the page belongs to another context");
  const network = typeof profile === "string" ? PHONE_NETWORK_PROFILES[profile] : profile;
  const session = await openChromiumSession(page, "throttleLikePhone");
  await session.send("Network.enable");
  await session.send("Network.emulateNetworkConditions", {
    offline: false,
    latency: network.latencyMs,
    downloadThroughput: network.downloadThroughput,
    uploadThroughput: network.uploadThroughput,
  });
  await session.send("Emulation.setCPUThrottlingRate", { rate: options.cpuSlowdown ?? PHONE_CPU_SLOWDOWN });
  return {
    async release() {
      await session.send("Network.emulateNetworkConditions", { offline: false, latency: 0, downloadThroughput: -1, uploadThroughput: -1 });
      await session.send("Emulation.setCPUThrottlingRate", { rate: 1 });
      await session.detach();
    },
  };
}

export interface ExpectLoadWithinOptions {
  /** The moment that counts, from the navigation's start. Default: `load`. */
  event?: "load" | "domcontentloaded";
}

/**
 * Opens `path` and asserts the page reached `event` within `budgetMs` (navigation timing, so a
 * throttle set with `throttleLikePhone` counts). Returns the measured milliseconds.
 */
export async function expectLoadWithin(page: Page, path: string, budgetMs: number, options: ExpectLoadWithinOptions = {}): Promise<number> {
  const event = options.event ?? "load";
  const response = await page.goto(path, { waitUntil: event });
  expect(response, `no response for ${path}`).not.toBeNull();
  const timingKey: "loadEventEnd" | "domContentLoadedEventEnd" = event === "load" ? "loadEventEnd" : "domContentLoadedEventEnd";
  // `loadEventEnd` is set once the load handlers return, which can be just after Playwright sees `load`.
  const timing = await page.waitForFunction((key) => {
    const [entry] = performance.getEntriesByType("navigation") as PerformanceNavigationTiming[];
    return entry !== undefined && entry[key] > 0 ? entry[key] : false;
  }, timingKey);
  const measuredMs = (await timing.jsonValue()) as number;
  const elapsedMs = Math.round(measuredMs);
  expect(elapsedMs, `${path} reached ${event} in ${String(elapsedMs)} ms, over the ${String(budgetMs)} ms budget`).toBeLessThanOrEqual(budgetMs);
  return elapsedMs;
}
