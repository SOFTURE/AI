// Shared setup: an app on https://app.example.com with the analytics module and its options.
import { analytics, type AnalyticsOptionsInput } from "@softure-ai/analytics";
import { defineSoftureConfig, type SoftureConfig } from "@softure-ai/core";

export const APP_ORIGIN = "https://app.example.com";

export function createConfig(options: AnalyticsOptionsInput = {}): SoftureConfig {
  return defineSoftureConfig({ database: null, locale: "en", timezone: "Europe/Warsaw", appOrigin: APP_ORIGIN, modules: [analytics(options)] });
}

/** A request as the browser sends it; `navigate` adds `Sec-Fetch-Mode: navigate`. */
export function createRequest(
  url: string,
  init: { referer?: string; navigate?: boolean; rsc?: boolean; nextUrl?: string; destination?: string; method?: string } = {},
): Request {
  const headers = new Headers();
  if (init.referer !== undefined) headers.set("referer", init.referer);
  if (init.navigate ?? true) headers.set("sec-fetch-mode", "navigate");
  if (init.rsc === true) {
    headers.set("sec-fetch-mode", "cors");
    headers.set("rsc", "1");
  }
  if (init.nextUrl !== undefined) {
    // What Next.js leaves of a client navigation once it stripped its flight headers.
    headers.set("sec-fetch-mode", "cors");
    headers.set("next-url", init.nextUrl);
  }
  if (init.destination !== undefined) headers.set("sec-fetch-dest", init.destination);
  return new Request(new URL(url, APP_ORIGIN), { method: init.method ?? "GET", headers });
}
