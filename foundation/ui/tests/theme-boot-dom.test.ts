import { Window } from "happy-dom";
import { afterEach, describe, expect, it } from "vitest";
import { applyThemeChoice, getThemeBootScript } from "../src/index.js";

const THEME_COLORS = { light: "#f6f7f8", dark: "#0c0c0d" } as const;

const windows: Window[] = [];

afterEach(async () => {
  await Promise.all(windows.splice(0).map((window) => window.happyDOM.close()));
});

/** A page whose `<head>` carries Next's two `viewport.themeColor` metas, with the given cookie. */
function createPage(cookie: string): Window {
  const window = new Window({ url: "https://example.com/" });
  windows.push(window);
  window.document.cookie = cookie;
  window.document.head.innerHTML = [
    `<meta name="theme-color" media="(prefers-color-scheme: light)" content="${THEME_COLORS.light}">`,
    `<meta name="theme-color" media="(prefers-color-scheme: dark)" content="${THEME_COLORS.dark}">`,
  ].join("");
  return window;
}

/** Runs the boot script against `window` the way the browser runs the inline `<script>`. */
function runBootScript(window: Window): void {
  // eslint-disable-next-line @typescript-eslint/no-implied-eval -- executing the inline script is the point of the test
  const script = new Function("document", "MutationObserver", getThemeBootScript({ themeColors: THEME_COLORS })) as (
    doc: unknown,
    observer: unknown,
  ) => void;
  script(window.document, window.MutationObserver);
}

/** Adds a theme-color meta the way Next's streamed metadata does, after the document is parsed. */
function insertLateMeta(window: Window, scheme: "light" | "dark", parent: "head" | "body" = "head"): void {
  const meta = window.document.createElement("meta");
  meta.setAttribute("name", "theme-color");
  meta.setAttribute("media", `(prefers-color-scheme: ${scheme})`);
  meta.setAttribute("content", THEME_COLORS[scheme]);
  window.document[parent].appendChild(meta);
}

function getBarColors(window: Window): string[] {
  return Array.from(window.document.querySelectorAll('meta[name="theme-color"]')).map(
    (meta) => meta.getAttribute("content") ?? "",
  );
}

/** Lets the mutation observer callbacks (microtasks) run. */
async function flushObservers(): Promise<void> {
  await new Promise<void>((resolve) => setTimeout(resolve, 0));
}

describe("boot script with late theme-color metas", () => {
  it("recolours a meta inserted after DOMContentLoaded to the explicit choice", async () => {
    const window = createPage("sft-theme=light");
    runBootScript(window);
    window.document.dispatchEvent(new window.Event("DOMContentLoaded"));
    insertLateMeta(window, "dark");
    await flushObservers();
    expect(getBarColors(window)).toEqual([THEME_COLORS.light, THEME_COLORS.light, THEME_COLORS.light]);
  });

  it("recolours a meta that arrives inside a wrapper element in the body", async () => {
    const window = createPage("sft-theme=dark");
    runBootScript(window);
    window.document.dispatchEvent(new window.Event("DOMContentLoaded"));
    const wrapper = window.document.createElement("div");
    wrapper.innerHTML = `<meta name="theme-color" content="${THEME_COLORS.light}">`;
    window.document.body.appendChild(wrapper);
    await flushObservers();
    expect(getBarColors(window)).toEqual([THEME_COLORS.dark, THEME_COLORS.dark, THEME_COLORS.dark]);
  });

  it("follows a later switch: a meta inserted after choosing dark gets the dark colour", async () => {
    const window = createPage("sft-theme=light");
    runBootScript(window);
    applyThemeChoice("dark", { doc: window.document as unknown as Document, themeColors: THEME_COLORS });
    insertLateMeta(window, "light", "body");
    await flushObservers();
    expect(getBarColors(window)).toEqual([THEME_COLORS.dark, THEME_COLORS.dark, THEME_COLORS.dark]);
  });

  it("leaves late metas alone after a switch to system", async () => {
    const window = createPage("sft-theme=dark");
    runBootScript(window);
    applyThemeChoice("system", { doc: window.document as unknown as Document, themeColors: THEME_COLORS });
    insertLateMeta(window, "light");
    await flushObservers();
    expect(getBarColors(window)).toEqual([THEME_COLORS.light, THEME_COLORS.dark, THEME_COLORS.light]);
  });

  it("does not touch the bar without an explicit choice", async () => {
    const window = createPage("");
    runBootScript(window);
    window.document.dispatchEvent(new window.Event("DOMContentLoaded"));
    insertLateMeta(window, "dark");
    await flushObservers();
    expect(window.document.documentElement.hasAttribute("data-theme")).toBe(false);
    expect(getBarColors(window)).toEqual([THEME_COLORS.light, THEME_COLORS.dark, THEME_COLORS.dark]);
  });
});
