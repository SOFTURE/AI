import type { Browser, BrowserContext, Page } from "playwright";

import type { ShotStep } from "../config/shot-steps.js";
import { containsPhrase } from "../film.js";
import { findStatusFailure } from "./gates.js";
import type { ScreenshotBrowser } from "./screenshot.js";
import { runShotSteps } from "./steps.js";

/**
 * `signIn` of marketing.json, done once per `shots` run: the sign-in page, its steps, then a phrase only a
 * signed-in page shows. The session (cookies and localStorage) stays in memory and opens every `signedIn: true`
 * screenshot; it is never written to disk. Values are resolved before they get here and never printed.
 */

/** The sign-in with its placeholders resolved. */
export interface SignInPlan {
  path: string;
  steps: ShotStep[];
  expect: string;
}

export type SessionState = Awaited<ReturnType<BrowserContext["storageState"]>>;

export type SignInResult = { ok: true; session: SessionState } | { ok: false; message: string };

const NAVIGATION_TIMEOUT_MS = 30_000;
/** The submit usually navigates and the next page loads its data: more time than a screenshot's 5 s. */
export const SIGN_IN_PHRASE_TIMEOUT_MS = 15_000;
const PHRASE_POLL_MS = 250;

function describeError(error: unknown): string {
  return error instanceof Error ? (error.message.split("\n")[0] ?? error.name) : String(error);
}

/** The page's visible text, or null while a navigation replaces the document (its context is destroyed). */
export async function readPageText(page: Page): Promise<string | null> {
  try {
    return await page.locator("body").innerText({ timeout: PHRASE_POLL_MS * 4 });
  } catch {
    // A navigation in flight or a body not there yet: the next poll reads the new page.
    return null;
  }
}

async function waitForSignedIn(page: Page, phrase: string): Promise<boolean> {
  const deadline = Date.now() + SIGN_IN_PHRASE_TIMEOUT_MS;
  for (;;) {
    const text = await readPageText(page);
    if (text !== null && containsPhrase(text, phrase)) return true;
    if (Date.now() >= deadline) return false;
    await page.waitForTimeout(PHRASE_POLL_MS);
  }
}

export interface SignInOptions {
  browser: Browser;
  baseUrl: string;
  settings: ScreenshotBrowser;
  plan: SignInPlan;
}

export async function signIn(options: SignInOptions): Promise<SignInResult> {
  const { browser, baseUrl, settings, plan } = options;
  const url = new URL(plan.path, baseUrl).href;
  const context = await browser.newContext({ colorScheme: settings.colorScheme, locale: settings.locale, timezoneId: settings.timezone });
  try {
    const page = await context.newPage();
    let status: number | null;
    try {
      const response = await page.goto(url, { waitUntil: "load", timeout: NAVIGATION_TIMEOUT_MS });
      status = response?.status() ?? null;
    } catch (error) {
      // Any navigation failure (refused connection, DNS, timeout) is the app's, not a bug of ours.
      return { ok: false, message: `loading the sign-in page ${url}: ${describeError(error)}` };
    }
    const statusFailure = findStatusFailure(status, url);
    if (statusFailure !== null) return { ok: false, message: `the sign-in page: ${statusFailure}` };
    const stepFailure = await runShotSteps(page, plan.steps, "signIn.steps");
    if (stepFailure !== null) return { ok: false, message: stepFailure };
    if (!(await waitForSignedIn(page, plan.expect))) {
      return { ok: false, message: `after the sign-in steps, ${new URL(page.url()).pathname} does not show "${plan.expect}" within ${SIGN_IN_PHRASE_TIMEOUT_MS / 1000} s` };
    }
    const session = await context.storageState();
    if (session.cookies.length === 0 && session.origins.length === 0) {
      return { ok: false, message: `the page shows "${plan.expect}", but the browser holds no session (no cookie, no localStorage); pick a phrase only a signed-in page shows` };
    }
    return { ok: true, session };
  } finally {
    await context.close();
  }
}
