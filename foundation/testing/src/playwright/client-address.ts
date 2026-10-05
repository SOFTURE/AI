import { randomInt } from "node:crypto";
import type { Browser, BrowserContextOptions, Page } from "@playwright/test";

/**
 * The header a SOFTURE app behind Cloudflare reads the client address from (`@softure-ai/security`
 * rate limits key on it). A test that sends its own address gets its own rate limit buckets.
 */
export const CLIENT_ADDRESS_HEADER = "cf-connecting-ip";

/**
 * A random address in 198.18.0.0/15, the block reserved for benchmark tests (RFC 2544), so it can
 * never be a real visitor's address. One per test keeps rate limit buckets from leaking between tests.
 */
export function randomClientAddress(): string {
  return `198.${String(18 + randomInt(2))}.${String(randomInt(256))}.${String(randomInt(1, 255))}`;
}

/** Headers that make a request come from `address` (a fresh random address by default). */
export function clientAddressHeaders(address: string = randomClientAddress()): Record<string, string> {
  return { [CLIENT_ADDRESS_HEADER]: address };
}

/**
 * A page in a new browser context with its own client address: a second visitor with no cookies.
 * The caller closes it with `page.context().close()` when the test needs the context gone early;
 * Playwright closes it with the browser otherwise.
 */
export async function openPageAsNewClient(browser: Browser, options: BrowserContextOptions = {}): Promise<Page> {
  const context = await browser.newContext({
    ...options,
    extraHTTPHeaders: { ...options.extraHTTPHeaders, ...clientAddressHeaders() },
  });
  return context.newPage();
}
