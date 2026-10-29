import { expect, type Locator, type Page } from "@playwright/test";

export interface ExpectWorksOfflineOptions {
  /** The page opened online, so the service worker installs and takes control. */
  path: string;
  /** What must show once offline: the kept page's content or the offline page's message. */
  answer: Locator;
  /** A path opened offline instead of reloading `path`, e.g. one never visited, to reach the offline page. */
  offlinePath?: string;
  /** How long the worker may take to control the page, in milliseconds. Default: 10 000. */
  timeout?: number;
}

/**
 * Opens `path`, waits until a service worker controls the page (reloading once for a worker that does
 * not claim its first client), goes offline, reloads (or opens `offlinePath`) and expects `answer`
 * visible. The context goes back online whatever happens.
 */
export async function expectWorksOffline(page: Page, options: ExpectWorksOfflineOptions): Promise<void> {
  const timeout = options.timeout ?? 10_000;
  await page.goto(options.path);
  await waitForController(page, options.path, timeout);
  const context = page.context();
  await context.setOffline(true);
  try {
    if (options.offlinePath === undefined) await page.reload();
    else await page.goto(options.offlinePath);
    await expect(options.answer, `offline answer of ${options.offlinePath ?? options.path}`).toBeVisible();
  } finally {
    await context.setOffline(false);
  }
}

async function waitForController(page: Page, path: string, timeout: number): Promise<void> {
  const hasWorker = await page.evaluate(() => "serviceWorker" in navigator);
  if (!hasWorker) throw new Error(`expectWorksOffline: ${path} has no service worker support (a secure origin is needed)`);
  const isReady = await page.evaluate(
    (ms) => Promise.race([navigator.serviceWorker.ready.then(() => true), new Promise<boolean>((resolve) => setTimeout(() => resolve(false), ms))]),
    timeout,
  );
  if (!isReady) throw new Error(`expectWorksOffline: no service worker took control of ${path} within ${String(timeout)} ms`);
  const isControlled = () => page.evaluate(() => navigator.serviceWorker.controller !== null);
  if (await isControlled()) return;
  await page.reload();
  try {
    await page.waitForFunction(() => navigator.serviceWorker.controller !== null, undefined, { timeout });
  } catch (error) {
    throw new Error(`expectWorksOffline: no service worker took control of ${path} within ${String(timeout)} ms`, { cause: error });
  }
}
