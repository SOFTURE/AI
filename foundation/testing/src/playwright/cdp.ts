import type { BrowserContext, CDPSession, Page } from "@playwright/test";

/**
 * A CDP session on the page, for the helpers Playwright has no API for. Chromium only: on another
 * browser it fails naming the helper, so a WebKit project shows why instead of a protocol error.
 */
export async function openChromiumSession(page: Page, helper: string): Promise<CDPSession> {
  const context: BrowserContext = page.context();
  const browserName = context.browser()?.browserType().name() ?? "chromium";
  if (browserName !== "chromium") throw new Error(`${helper} needs Chromium (CDP), got ${browserName}`);
  return context.newCDPSession(page);
}
