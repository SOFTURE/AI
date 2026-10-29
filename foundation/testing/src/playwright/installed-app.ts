import type { BrowserContext, Page } from "@playwright/test";

/**
 * Makes every page of the target look like the installed app: iOS's `navigator.standalone` is `true`,
 * and `display-mode` reads `standalone` in `matchMedia` and in same-origin style sheets (`<style>`
 * and `<link>`, including ones added later). Install offers stay away and standalone styles apply.
 * Works in every browser: Chromium's CDP does not emulate `display-mode`, so the init script rewrites
 * the media conditions. Cross-origin style sheets cannot be read and keep their own answer. Call it
 * before the page opens (an init script runs on the next navigation).
 */
export async function emulateInstalledApp(target: BrowserContext | Page): Promise<void> {
  await target.addInitScript(installStandaloneDisplayMode);
}

// Runs in the page, so it cannot use anything outside its own body.
function installStandaloneDisplayMode(): void {
  const ALWAYS = "(min-width: 0px)";
  const NEVER = "(max-width: -1px)";
  const rewriteQuery = (query: string): string =>
    query.replace(/\(\s*display-mode\s*(?::\s*([a-z-]+)\s*)?\)/gi, (_match, value: string | undefined) =>
      value === undefined || value.toLowerCase() === "standalone" ? ALWAYS : NEVER,
    );

  Object.defineProperty(Navigator.prototype, "standalone", { configurable: true, get: () => true });

  const originalMatchMedia = window.matchMedia.bind(window);
  window.matchMedia = (query: string) => originalMatchMedia(rewriteQuery(query));

  const rewriteRules = (rules: CSSRuleList): void => {
    for (const rule of Array.from(rules)) {
      if (rule instanceof CSSMediaRule && /display-mode/i.test(rule.media.mediaText)) rule.media.mediaText = rewriteQuery(rule.media.mediaText);
      if ("cssRules" in rule && rule.cssRules instanceof CSSRuleList) rewriteRules(rule.cssRules);
    }
  };
  const rewriteSheets = (): void => {
    for (const sheet of Array.from(document.styleSheets)) {
      try {
        rewriteRules(sheet.cssRules);
      } catch {
        // A cross-origin sheet hides its rules; it keeps its own answer (documented above).
      }
    }
    for (const element of Array.from(document.querySelectorAll<HTMLLinkElement | HTMLStyleElement>("link[media], style[media]"))) {
      if (/display-mode/i.test(element.media)) element.media = rewriteQuery(element.media);
    }
  };

  new MutationObserver(rewriteSheets).observe(document, { childList: true, subtree: true });
  document.addEventListener("load", rewriteSheets, true);
  document.addEventListener("DOMContentLoaded", rewriteSheets);
}
