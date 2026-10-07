import { mkdirSync, rmSync, statSync } from "node:fs";
import { basename, dirname, extname, join } from "node:path";

import { chromium, errors, type Browser, type Page } from "playwright";

import type { ColorTheme } from "../config/colors.js";
import type { MarketingJson } from "../config/schema.js";
import { getScreenshotNames, getScreenshotShots } from "../config/screenshot-names.js";
import { containsPhrase } from "../film.js";
import { findScrollFailure, findSizeFailure, findStatusFailure, type ScreenshotGate } from "./gates.js";

/**
 * `softure-marketing shots`: the `screenshots` entries of `marketing.json`. Each shot of an entry
 * (one per colour scheme, `config/screenshot-names.ts`) gets a fresh browser context with the entry's viewport, device
 * scale and motion preference, and is kept only when it passes every gate (`gates.ts`) on its own.
 * Every file an entry could write is removed before it runs, so a failed shot leaves no file behind,
 * not even an older one: a stale PNG must never look like a fresh pass.
 */

export type ScreenshotEntry = MarketingJson["screenshots"][number];

/** How the browser presents itself to the app, from `marketing.json`. */
export interface ScreenshotBrowser {
  /** The scheme of an entry without `colorSchemes`. */
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
  /** Folder of the PNG files (`<outDir>/<name>.png`). */
  outDir: string;
  browser: ScreenshotBrowser;
  /** A Chromium to use instead of Playwright's own (`PLAYWRIGHT_CHROMIUM_PATH`). */
  executablePath?: string;
}

/** `id` is the entry's, `name` the file's without `.png` (`<id>` or `<id>-<scheme>`). */
export type ScreenshotResult =
  | { ok: true; id: string; name: string; file: string; bytes: number }
  | { ok: false; id: string; name: string; gate: ScreenshotGate; message: string };

const NAVIGATION_TIMEOUT_MS = 30_000;
/** How long client-side rendering gets to show the expected phrase after the page loaded. */
const PHRASE_TIMEOUT_MS = 5000;
const PHRASE_POLL_MS = 250;
/** Upper bound of the lazy-load scroll: a page with infinite scrolling must still end. */
const MAX_SCROLL_STEPS = 100;
const SCROLL_PAUSE_MS = 150;

export function getScreenshotFile(outDir: string, name: string): string {
  return join(outDir, `${name}.png`);
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

/** One file to capture: the entry it belongs to, its name, the page and the file. */
interface ShotTarget {
  entry: ScreenshotEntry;
  name: string;
  url: string;
  file: string;
}

async function takeOne(page: Page, target: ShotTarget): Promise<ScreenshotResult> {
  const { entry, name, url } = target;
  const refuse = (gate: ScreenshotGate, message: string): ScreenshotResult => ({ ok: false, id: entry.id, name, gate, message });
  let status: number | null;
  try {
    const response = await page.goto(url, { waitUntil: "networkidle", timeout: NAVIGATION_TIMEOUT_MS });
    status = response?.status() ?? null;
  } catch (error) {
    // Any navigation failure (refused connection, DNS, timeout) is the page's, not a bug of ours.
    return refuse("load", `loading ${url}: ${describeError(error)}`);
  }
  const statusFailure = findStatusFailure(status, url);
  if (statusFailure !== null) return refuse("status", statusFailure);
  try {
    return await captureLoadedPage(page, target);
  } catch (error) {
    // A page that never settles (long polling keeps the network busy, a frozen script) times out;
    // any other error is a bug and propagates.
    if (!(error instanceof errors.TimeoutError)) throw error;
    return refuse("load", `capturing ${url}: ${describeError(error)}`);
  }
}

async function captureLoadedPage(page: Page, target: ShotTarget): Promise<ScreenshotResult> {
  const { entry, name, url, file } = target;
  await page.evaluate(() => document.fonts.ready);
  if (entry.full) await scrollThroughPage(page);
  if (entry.scrollTo !== undefined) {
    const reached = await page.evaluate((top) => {
      window.scrollTo(0, top);
      return window.scrollY;
    }, entry.scrollTo);
    const scrollFailure = findScrollFailure(reached, entry.scrollTo);
    if (scrollFailure !== null) return { ok: false, id: entry.id, name, gate: "scroll", message: scrollFailure };
  }
  if (entry.waitMs > 0) await page.waitForTimeout(entry.waitMs);
  if (!(await waitForPhrase(page, entry.expect))) {
    return { ok: false, id: entry.id, name, gate: "phrase", message: `${url} does not show "${entry.expect}"` };
  }
  await page.screenshot({ path: file, fullPage: entry.full });
  const bytes = statSync(file).size;
  const sizeFailure = findSizeFailure(bytes, entry.minBytes);
  if (sizeFailure !== null) {
    rmSync(file, { force: true });
    return { ok: false, id: entry.id, name, gate: "size", message: sizeFailure };
  }
  return { ok: true, id: entry.id, name, file, bytes };
}

/** Removes every file the entry could have written in an earlier run, with or without `colorSchemes`. */
function removeEntryFiles(outDir: string, entry: ScreenshotEntry): void {
  for (const name of getScreenshotNames(entry.id)) rmSync(getScreenshotFile(outDir, name), { force: true });
}

interface TakeShotOptions {
  browser: Browser;
  settings: ScreenshotBrowser;
  target: ShotTarget;
  scheme: ColorTheme;
}

async function takeShot(options: TakeShotOptions): Promise<ScreenshotResult> {
  const { browser, settings, target, scheme } = options;
  const { entry } = target;
  const context = await browser.newContext({
    viewport: { width: entry.width, height: entry.height },
    deviceScaleFactor: entry.scale,
    colorScheme: scheme,
    locale: settings.locale,
    timezoneId: settings.timezone,
    reducedMotion: entry.motion,
    // Resolved to an absolute path by the caller (the CLI resolves it against the folder of marketing.json).
    ...(entry.storageState === undefined ? {} : { storageState: entry.storageState }),
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
    return await takeOne(page, target);
  } finally {
    await context.close();
  }
}

/** Takes every shot of every entry in order; one failing shot does not stop the others. */
export async function takeScreenshots(options: TakeScreenshotsOptions): Promise<ScreenshotResult[]> {
  const { entries, baseUrl, outDir, browser: settings } = options;
  mkdirSync(outDir, { recursive: true });
  const browser = await chromium.launch(options.executablePath === undefined ? {} : { executablePath: options.executablePath });
  const results: ScreenshotResult[] = [];
  try {
    for (const entry of entries) {
      removeEntryFiles(outDir, entry);
      for (const shot of getScreenshotShots(entry, settings.colorScheme)) {
        const target = { entry, name: shot.name, url: new URL(entry.path, baseUrl).href, file: getScreenshotFile(outDir, shot.name) };
        results.push(await takeShot({ browser, settings, target, scheme: shot.scheme }));
      }
    }
  } finally {
    await browser.close();
  }
  return results;
}

export interface TakePageScreenshotOptions {
  /** The shot's settings; its `path` is ignored, `url` is the page. */
  entry: ScreenshotEntry;
  /** The page to capture, any http(s) address. */
  url: string;
  /** The PNG to write; removed first, so a refused shot leaves no older file behind. */
  file: string;
  /** The scheme the browser prefers; `browser.colorScheme` when absent. */
  scheme?: ColorTheme;
  browser: ScreenshotBrowser;
  executablePath?: string;
}

/**
 * One page anywhere (`shots --page`): a competitor's page, production, a page of another app. The same browser
 * settings and gates as an entry, one file at the given path, and no app is started.
 */
export async function takePageScreenshot(options: TakePageScreenshotOptions): Promise<ScreenshotResult> {
  const { entry, url, file, browser: settings } = options;
  rmSync(file, { force: true });
  mkdirSync(dirname(file), { recursive: true });
  const browser = await chromium.launch(options.executablePath === undefined ? {} : { executablePath: options.executablePath });
  try {
    const target = { entry, name: basename(file, extname(file)), url, file };
    return await takeShot({ browser, settings, target, scheme: options.scheme ?? settings.colorScheme });
  } finally {
    await browser.close();
  }
}
