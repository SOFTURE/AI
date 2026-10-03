import { mkdirSync, rmSync, statSync } from "node:fs";
import { join } from "node:path";

import { chromium, errors, type Page } from "playwright";

import type { ColorTheme } from "../config/colors.js";
import type { MarketingJson } from "../config/schema.js";
import { containsPhrase } from "../film.js";
import { findSizeFailure, findStatusFailure, type ScreenshotGate } from "./gates.js";

/**
 * `softure-marketing shots`: the `screenshots` entries of `marketing.json`, each in a fresh browser
 * context with its own viewport and motion preference, kept only when it passes every gate
 * (`gates.ts`). A failed entry leaves no file behind, not even an older one: a stale PNG must never
 * look like a fresh pass.
 */

export type ScreenshotEntry = MarketingJson["screenshots"][number];

/** How the browser presents itself to the app, from `marketing.json`. */
export interface ScreenshotBrowser {
  colorScheme: ColorTheme;
  /** BCP 47, e.g. `en-US`. */
  locale: string;
  /** IANA zone, e.g. `Europe/London`. */
  timezone: string;
  /** Elements hidden in the screenshot (a dev overlay, a floating banner). */
  hideSelectors: string[];
}

export interface TakeScreenshotsOptions {
  entries: ScreenshotEntry[];
  /** The app's address; each entry's `path` resolves against it. */
  baseUrl: string;
  /** Folder of the PNG files (`<outDir>/<id>.png`). */
  outDir: string;
  browser: ScreenshotBrowser;
  /** A Chromium to use instead of Playwright's own (`PLAYWRIGHT_CHROMIUM_PATH`). */
  executablePath?: string;
}

export type ScreenshotResult =
  | { ok: true; id: string; file: string; bytes: number }
  | { ok: false; id: string; gate: ScreenshotGate; message: string };

const NAVIGATION_TIMEOUT_MS = 30_000;
/** How long client-side rendering gets to show the expected phrase after the page loaded. */
const PHRASE_TIMEOUT_MS = 5000;
const PHRASE_POLL_MS = 250;
/** Upper bound of the lazy-load scroll: a page with infinite scrolling must still end. */
const MAX_SCROLL_STEPS = 100;
const SCROLL_PAUSE_MS = 150;

export function getScreenshotFile(outDir: string, id: string): string {
  return join(outDir, `${id}.png`);
}

/** Scrolls one viewport at a time to the bottom so lazy images and sections load, then back to the top. */
async function scrollThroughPage(page: Page): Promise<void> {
  for (let step = 0; step < MAX_SCROLL_STEPS; step += 1) {
    const isAtBottom = await page.evaluate(() => {
      window.scrollBy(0, window.innerHeight);
      return window.scrollY + window.innerHeight >= document.documentElement.scrollHeight - 1;
    });
    await page.waitForTimeout(SCROLL_PAUSE_MS);
    if (isAtBottom) break;
  }
  await page.waitForLoadState("networkidle");
  await page.evaluate(() => window.scrollTo(0, 0));
}

async function waitForPhrase(page: Page, phrase: string): Promise<boolean> {
  const deadline = Date.now() + PHRASE_TIMEOUT_MS;
  for (;;) {
    if (containsPhrase(await page.locator("body").innerText(), phrase)) return true;
    if (Date.now() >= deadline) return false;
    await page.waitForTimeout(PHRASE_POLL_MS);
  }
}

function describeError(error: unknown): string {
  return error instanceof Error ? (error.message.split("\n")[0] ?? error.name) : String(error);
}

async function takeOne(page: Page, entry: ScreenshotEntry, url: string, file: string): Promise<ScreenshotResult> {
  let status: number | null;
  try {
    const response = await page.goto(url, { waitUntil: "networkidle", timeout: NAVIGATION_TIMEOUT_MS });
    status = response?.status() ?? null;
  } catch (error) {
    // Any navigation failure (refused connection, DNS, timeout) is the page's, not a bug of ours.
    return { ok: false, id: entry.id, gate: "load", message: `loading ${url}: ${describeError(error)}` };
  }
  const statusFailure = findStatusFailure(status, url);
  if (statusFailure !== null) return { ok: false, id: entry.id, gate: "status", message: statusFailure };
  try {
    return await captureLoadedPage(page, entry, url, file);
  } catch (error) {
    // A page that never settles (long polling keeps the network busy, a frozen script) times out;
    // any other error is a bug and propagates.
    if (!(error instanceof errors.TimeoutError)) throw error;
    return { ok: false, id: entry.id, gate: "load", message: `capturing ${url}: ${describeError(error)}` };
  }
}

async function captureLoadedPage(page: Page, entry: ScreenshotEntry, url: string, file: string): Promise<ScreenshotResult> {
  await page.evaluate(() => document.fonts.ready);
  if (entry.full) await scrollThroughPage(page);
  if (!(await waitForPhrase(page, entry.expect))) {
    return { ok: false, id: entry.id, gate: "phrase", message: `${url} does not show "${entry.expect}"` };
  }
  await page.screenshot({ path: file, fullPage: entry.full });
  const bytes = statSync(file).size;
  const sizeFailure = findSizeFailure(bytes, entry.minBytes);
  if (sizeFailure !== null) {
    rmSync(file, { force: true });
    return { ok: false, id: entry.id, gate: "size", message: sizeFailure };
  }
  return { ok: true, id: entry.id, file, bytes };
}

/** Takes every entry in order; one failing entry does not stop the others. */
export async function takeScreenshots(options: TakeScreenshotsOptions): Promise<ScreenshotResult[]> {
  const { entries, baseUrl, outDir, browser: settings } = options;
  mkdirSync(outDir, { recursive: true });
  const browser = await chromium.launch(options.executablePath === undefined ? {} : { executablePath: options.executablePath });
  const results: ScreenshotResult[] = [];
  try {
    for (const entry of entries) {
      const file = getScreenshotFile(outDir, entry.id);
      rmSync(file, { force: true });
      const context = await browser.newContext({
        viewport: { width: entry.width, height: entry.height },
        colorScheme: settings.colorScheme,
        locale: settings.locale,
        timezoneId: settings.timezone,
        reducedMotion: entry.motion,
      });
      try {
        const page = await context.newPage();
        // One tag per selector, so a selector the browser cannot parse drops only its own rule;
        // instant scrolling, because "smooth" would still be moving when the full page is captured.
        // An init script, so the rules hold from the first paint, before the gates read the page.
        const css = [...settings.hideSelectors.map((selector) => `${selector}{display:none!important}`), "html{scroll-behavior:auto!important}"];
        await page.addInitScript((rules: string[]) => {
          document.addEventListener("DOMContentLoaded", () => {
            for (const rule of rules) {
              const style = document.createElement("style");
              style.textContent = rule;
              document.head.append(style);
            }
          });
        }, css);
        results.push(await takeOne(page, entry, new URL(entry.path, baseUrl).href, file));
      } finally {
        await context.close();
      }
    }
  } finally {
    await browser.close();
  }
  return results;
}
