import { existsSync } from "node:fs";
import { chromium } from "@playwright/test";

/**
 * The Chromium the browser tests drive: `PLAYWRIGHT_CHROMIUM_PATH` (CI sets it to the runner's
 * Chrome) or Playwright's own build. Without either the browser tests skip; a configured path that
 * does not exist fails them, so CI never skips them silently.
 */
export const CHROMIUM_PATH = process.env.PLAYWRIGHT_CHROMIUM_PATH || undefined;

export const hasChromium = CHROMIUM_PATH !== undefined || existsSync(chromium.executablePath());
