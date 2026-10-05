import { expect, type Locator, type Page } from "@playwright/test";

export interface FollowLinkOptions {
  /**
   * The origin the link must point to when the image under test was built for production and renders
   * absolute URLs to another host; `null` when it renders relative links that stay on the host.
   */
  readonly expectedOrigin: string | null;
}

/**
 * Follows a link that may lead to another host. Without an expected origin the link must stay on
 * the host under test and is clicked. With one, its `href` must point to that origin, and the test
 * opens the same path on the host under test (with the page as `Referer`) instead of clicking, which
 * would leave for the live production site.
 */
export async function followLink(page: Page, link: Locator, options: FollowLinkOptions): Promise<void> {
  const href = await link.getAttribute("href");
  expect(href, "the link has no href").toBeTruthy();
  const current = new URL(page.url());
  const target = new URL(href ?? "", current);
  if (options.expectedOrigin === null) {
    expect(target.origin, `the link ${String(href)} leaves the host under test`).toBe(current.origin);
    await link.click();
    return;
  }
  expect(target.origin, `the link ${String(href)} must carry the production origin`).toBe(options.expectedOrigin);
  current.hash = "";
  await page.goto(`${target.pathname}${target.search}${target.hash}`, { referer: current.toString() });
}

/** The `href` of a link, failing with the link in the message when it has none. */
export async function readHref(link: Locator): Promise<string> {
  const href = await link.getAttribute("href");
  if (href === null) throw new Error(`readHref: ${link.toString()} has no href`);
  return href;
}
