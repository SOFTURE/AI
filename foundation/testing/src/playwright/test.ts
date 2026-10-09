import { test as base } from "@playwright/test";
import { CLIENT_ADDRESS_HEADER, randomClientAddress } from "./client-address.js";

export interface ClientAddressFixtures {
  /** This test's client address: a fresh random one per test, sent by `page`, `context` and `request`. */
  clientAddress: string;
}

/**
 * Playwright's `test` with a client address of its own per test, so `@softure-ai/security` rate limit
 * buckets never leak from one test into another. The address goes on top of the configured
 * `extraHTTPHeaders`. A page opened in another context (`browser.newContext()`) does not get it: use
 * `openPageAsNewClient` for a second visitor.
 */
export const test = base.extend<ClientAddressFixtures>({
  // Playwright's fixture signature: the first argument destructures the fixtures a fixture needs.
  // eslint-disable-next-line no-empty-pattern
  clientAddress: async ({}, use) => {
    await use(randomClientAddress());
  },
  context: async ({ context, extraHTTPHeaders, clientAddress }, use) => {
    await context.setExtraHTTPHeaders({ ...extraHTTPHeaders, [CLIENT_ADDRESS_HEADER]: clientAddress });
    await use(context);
  },
  request: async ({ playwright, extraHTTPHeaders, clientAddress }, use) => {
    // The config's other options (baseURL, credentials) still apply: they are the context defaults.
    const request = await playwright.request.newContext({ extraHTTPHeaders: { ...extraHTTPHeaders, [CLIENT_ADDRESS_HEADER]: clientAddress } });
    await use(request);
    await request.dispose();
  },
});

export { expect } from "@playwright/test";
