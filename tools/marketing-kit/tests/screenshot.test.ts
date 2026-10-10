import { mkdirSync, readFileSync, rmSync, writeFileSync, existsSync, mkdtempSync } from "node:fs";
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { findScrollFailure, findSizeFailure, findStatusFailure } from "../src/screenshot/gates.js";
import { getScreenshotShots } from "../src/config/screenshot-names.js";
import { getScreenshotFile, takeScreenshots, type ScreenshotEntry, type TakeScreenshotsOptions } from "../src/screenshot/screenshot.js";
import { chromium, type Browser, type Page } from "playwright";

import type { ShotStep } from "../src/config/shot-steps.js";
import { runShotSteps } from "../src/screenshot/steps.js";
import type { SignInPlan } from "../src/screenshot/sign-in.js";
import { CHROMIUM_PATH, hasChromium } from "./chromium.js";

const PAGES = join(import.meta.dirname, "fixtures", "screenshots");

function makeEntry(overrides: Partial<ScreenshotEntry> & Pick<ScreenshotEntry, "id" | "path" | "expect">): ScreenshotEntry {
  return { width: 800, height: 600, full: false, motion: "reduce", minBytes: 0, scale: 1, waitMs: 0, signedIn: false, steps: [], hide: [], ...overrides };
}

/** Height of a PNG from its IHDR chunk. */
function readPngHeight(file: string): number {
  return readFileSync(file).readUInt32BE(20);
}

/** The RGB of one pixel of a PNG, decoded by the browser. */
async function readPixel(file: string, x: number, y: number): Promise<[number, number, number]> {
  const browser = await chromium.launch(CHROMIUM_PATH === undefined ? {} : { executablePath: CHROMIUM_PATH });
  try {
    const page = await browser.newPage();
    const source = `data:image/png;base64,${readFileSync(file).toString("base64")}`;
    return await page.evaluate(
      async ({ source, x, y }) => {
        const image = new Image();
        image.src = source;
        await image.decode();
        const canvas = document.createElement("canvas");
        canvas.width = image.width;
        canvas.height = image.height;
        const context = canvas.getContext("2d");
        if (context === null) throw new Error("no 2d context");
        context.drawImage(image, 0, 0);
        const [red = 0, green = 0, blue = 0] = context.getImageData(x, y, 1, 1).data;
        return [red, green, blue] as [number, number, number];
      },
      { source, x, y },
    );
  } finally {
    await browser.close();
  }
}

/** Width of a PNG from its IHDR chunk. */
function readPngWidth(file: string): number {
  return readFileSync(file).readUInt32BE(16);
}

describe("screenshot gates", () => {
  it("passes statuses below 400", () => {
    expect(findStatusFailure(200, "http://x/")).toBeNull();
    expect(findStatusFailure(399, "http://x/")).toBeNull();
  });

  it("refuses 400 and above, and a navigation without a response", () => {
    expect(findStatusFailure(400, "http://x/a")).toBe("HTTP 400 from http://x/a");
    expect(findStatusFailure(503, "http://x/a")).toBe("HTTP 503 from http://x/a");
    expect(findStatusFailure(null, "http://x/a")).toBe("no HTTP response from http://x/a");
  });

  it("passes a scroll that reached the offset and refuses one that stopped short", () => {
    expect(findScrollFailure(2600, 2600)).toBeNull();
    expect(findScrollFailure(2599.5, 2600)).toBeNull();
    expect(findScrollFailure(2400, 2600)).toBe("the page scrolls only to 2400 px, short of scrollTo 2600");
  });

  it("passes a file of exactly minBytes and refuses one byte less", () => {
    expect(findSizeFailure(40_000, 40_000)).toBeNull();
    expect(findSizeFailure(39_999, 40_000)).toBe("the file has 39999 bytes, below minBytes 40000 (a blank or broken page); deleted");
  });
});

describe("screenshot shots", () => {
  it("takes one shot named by the id in the app's scheme without colorSchemes", () => {
    expect(getScreenshotShots({ id: "hero" }, "dark")).toEqual([{ name: "hero", scheme: "dark" }]);
  });

  it("takes one suffixed shot per listed scheme, in the listed order", () => {
    expect(getScreenshotShots({ id: "hero", colorSchemes: ["dark", "light"] }, "light")).toEqual([
      { name: "hero-dark", scheme: "dark" },
      { name: "hero-light", scheme: "light" },
    ]);
  });
});

describe.runIf(hasChromium)("takeScreenshots against static pages", () => {
  let server: Server;
  let baseUrl: string;
  const outDir = mkdtempSync(join(tmpdir(), "marketing-kit-shots-"));

  beforeAll(async () => {
    server = createServer((request, response) => {
      const name = new URL(request.url ?? "/", "http://localhost").pathname.slice(1);
      if (name === "private") {
        const isSignedIn = (request.headers.cookie ?? "").split(/;\s*/).includes("session=signed-in");
        response.writeHead(200, { "Content-Type": "text/html" }).end(isSignedIn ? readFileSync(join(PAGES, "dashboard.html")) : "<p>Sign in first</p>");
        return;
      }
      if (!/^[a-z]+\.html$/.test(name) || !existsSync(join(PAGES, name))) {
        response.writeHead(404, { "Content-Type": "text/html" }).end("<p>Count your date</p>");
        return;
      }
      response.writeHead(200, { "Content-Type": "text/html; charset=utf-8" }).end(readFileSync(join(PAGES, name)));
    });
    await new Promise<void>((done) => server.listen(0, "127.0.0.1", done));
    baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  });

  afterAll(async () => {
    await new Promise((done) => server.close(done));
    rmSync(outDir, { recursive: true, force: true });
  });

  const take = (entries: ScreenshotEntry[], overrides: Partial<TakeScreenshotsOptions> = {}) =>
    takeScreenshots({
      entries,
      baseUrl,
      outDir,
      browser: { colorScheme: "dark", locale: "en-US", timezone: "UTC", hideSelectors: [] },
      executablePath: CHROMIUM_PATH,
      ...overrides,
    });

  it("keeps a page that passes every gate, above the 40 kB default", async () => {
    const [result] = await take([makeEntry({ id: "noise", path: "/noise.html", expect: "Count your date", minBytes: 40_000 })]);
    expect(result).toMatchObject({ ok: true, id: "noise", file: getScreenshotFile(outDir, "noise") });
    expect(result?.ok && result.bytes).toBeGreaterThanOrEqual(40_000);
    expect(existsSync(getScreenshotFile(outDir, "noise"))).toBe(true);
  });

  it("refuses an HTTP 404 even when the error page shows the phrase, and writes no file", async () => {
    const [result] = await take([makeEntry({ id: "missing", path: "/missing.html", expect: "Count your date" })]);
    expect(result).toEqual({ ok: false, id: "missing", name: "missing", gate: "status", message: `HTTP 404 from ${baseUrl}/missing.html` });
    expect(existsSync(getScreenshotFile(outDir, "missing"))).toBe(false);
  });

  it("refuses an app that does not answer, as the load gate", async () => {
    const [result] = await take([makeEntry({ id: "down", path: "/noise.html", expect: "Count your date" })], { baseUrl: "http://127.0.0.1:1" });
    expect(result).toMatchObject({ ok: false, id: "down", gate: "load" });
    expect(result?.ok === false && result.message).toMatch(/^loading http:\/\/127\.0\.0\.1:1\/noise\.html: .*net::ERR_/);
  });

  it("refuses a page without the expected phrase", async () => {
    const [result] = await take([makeEntry({ id: "wrong-phrase", path: "/plain.html", expect: "Count your date" })]);
    expect(result).toEqual({ ok: false, id: "wrong-phrase", name: "wrong-phrase", gate: "phrase", message: `${baseUrl}/plain.html does not show "Count your date"` });
    expect(existsSync(getScreenshotFile(outDir, "wrong-phrase"))).toBe(false);
  });

  it("deletes a file below the 40 kB default", async () => {
    const [result] = await take([makeEntry({ id: "small", path: "/plain.html", expect: "Almost empty", minBytes: 40_000 })]);
    expect(result).toMatchObject({ ok: false, id: "small", gate: "size" });
    expect(result?.ok === false && result.message).toMatch(/^the file has \d+ bytes, below minBytes 40000 \(a blank or broken page\); deleted$/);
    expect(existsSync(getScreenshotFile(outDir, "small"))).toBe(false);
  });

  it("removes an older file of an entry whose gate fails now", async () => {
    mkdirSync(outDir, { recursive: true });
    writeFileSync(getScreenshotFile(outDir, "stale"), "an old screenshot");
    const [result] = await take([makeEntry({ id: "stale", path: "/missing.html", expect: "Count your date" })]);
    expect(result).toMatchObject({ ok: false, gate: "status" });
    expect(existsSync(getScreenshotFile(outDir, "stale"))).toBe(false);
  });

  it("captures only the viewport and misses lazy content without full", async () => {
    const [result] = await take([makeEntry({ id: "tall-viewport", path: "/tall.html", expect: "Lazy section loaded" })]);
    expect(result).toMatchObject({ ok: false, gate: "phrase" });
    const [viewportOnly] = await take([makeEntry({ id: "tall-top", path: "/tall.html", expect: "A long page" })]);
    expect(viewportOnly?.ok).toBe(true);
    expect(readPngHeight(getScreenshotFile(outDir, "tall-top"))).toBe(600);
  });

  it("with full, scrolls so lazy content loads and captures the whole page", async () => {
    const [result] = await take([makeEntry({ id: "tall-full", path: "/tall.html", expect: "Lazy section loaded", full: true })]);
    expect(result?.ok).toBe(true);
    expect(readPngHeight(getScreenshotFile(outDir, "tall-full"))).toBeGreaterThan(3000);
  });

  it("sets the motion preference per entry and the colour scheme from the config", async () => {
    const results = await take([
      makeEntry({ id: "reduced", path: "/motion.html", expect: "Motion reduced", motion: "reduce" }),
      makeEntry({ id: "allowed", path: "/motion.html", expect: "Motion allowed", motion: "no-preference" }),
      // Another width than "reduced", which this entry would otherwise repeat byte for byte (the duplicate gate).
      makeEntry({ id: "dark", path: "/motion.html", expect: "Scheme dark", width: 700 }),
    ]);
    expect(results.map((result) => [result.id, result.ok])).toEqual([
      ["reduced", true],
      ["allowed", true],
      ["dark", true],
    ]);
  });

  it("hides the configured selectors before the phrase gate reads the page", async () => {
    const [result] = await take([makeEntry({ id: "hidden", path: "/plain.html", expect: "A floating banner" })], {
      browser: { colorScheme: "light", locale: "en-US", timezone: "UTC", hideSelectors: [".banner"] },
    });
    expect(result).toMatchObject({ ok: false, gate: "phrase" });
  });

  it("captures at the entry's device scale", async () => {
    const [result] = await take([makeEntry({ id: "retina", path: "/plain.html", expect: "Almost empty", scale: 2 })]);
    expect(result).toMatchObject({ ok: true, name: "retina" });
    const file = getScreenshotFile(outDir, "retina");
    expect([readPngWidth(file), readPngHeight(file)]).toEqual([1600, 1200]);
  });

  it("captures and gates each listed scheme on its own file", async () => {
    const results = await take([makeEntry({ id: "pair", path: "/motion.html", expect: "Scheme dark", colorSchemes: ["light", "dark"] })]);
    expect(results).toEqual([
      { ok: false, id: "pair", name: "pair-light", gate: "phrase", message: `${baseUrl}/motion.html does not show "Scheme dark"` },
      { ok: true, id: "pair", name: "pair-dark", file: getScreenshotFile(outDir, "pair-dark"), bytes: expect.any(Number) as number },
    ]);
    expect(existsSync(getScreenshotFile(outDir, "pair-light"))).toBe(false);
    expect(existsSync(getScreenshotFile(outDir, "pair-dark"))).toBe(true);
  });

  it("removes the older single file of an entry that now lists its schemes, and the pair of one that no longer does", async () => {
    mkdirSync(outDir, { recursive: true });
    writeFileSync(getScreenshotFile(outDir, "switched"), "an old screenshot");
    await take([makeEntry({ id: "switched", path: "/motion.html", expect: "Scheme", colorSchemes: ["light", "dark"] })]);
    expect(existsSync(getScreenshotFile(outDir, "switched"))).toBe(false);
    expect(existsSync(getScreenshotFile(outDir, "switched-light"))).toBe(true);
    await take([makeEntry({ id: "switched", path: "/motion.html", expect: "Scheme" })]);
    expect(existsSync(getScreenshotFile(outDir, "switched-light"))).toBe(false);
    expect(existsSync(getScreenshotFile(outDir, "switched-dark"))).toBe(false);
    expect(existsSync(getScreenshotFile(outDir, "switched"))).toBe(true);
  });

  it("captures one viewport frame at scrollTo, where the scroll-driven section shows", async () => {
    const [top] = await take([makeEntry({ id: "scroll-top", path: "/reveal.html", expect: "Revealed on scroll" })]);
    expect(top).toMatchObject({ ok: false, gate: "phrase" });
    const [frame] = await take([makeEntry({ id: "scroll-frame", path: "/reveal.html", expect: "Revealed on scroll", scrollTo: 1800 })]);
    expect(frame).toMatchObject({ ok: true, name: "scroll-frame" });
    expect(readPngHeight(getScreenshotFile(outDir, "scroll-frame"))).toBe(600);
  });

  it("refuses a scrollTo the page cannot reach, as the scroll gate, and writes no file", async () => {
    const [result] = await take([makeEntry({ id: "scroll-past", path: "/plain.html", expect: "Almost empty", scrollTo: 5000 })]);
    expect(result).toEqual({ ok: false, id: "scroll-past", name: "scroll-past", gate: "scroll", message: "the page scrolls only to 0 px, short of scrollTo 5000" });
    expect(existsSync(getScreenshotFile(outDir, "scroll-past"))).toBe(false);
  });

  it("waits waitMs after loading, before the phrase gate reads the page", async () => {
    const [early] = await take([makeEntry({ id: "settling-early", path: "/settling.html", expect: "Still settling" })]);
    expect(early?.ok).toBe(true);
    const [waited] = await take([makeEntry({ id: "settling-waited", path: "/settling.html", expect: "Still settling", waitMs: 1500 })]);
    expect(waited).toMatchObject({ ok: false, gate: "phrase" });
    const [settled] = await take([makeEntry({ id: "settling-settled", path: "/settling.html", expect: "Settled", waitMs: 1500 })]);
    expect(settled?.ok).toBe(true);
  });

  it("opens the page signed in with the entry's storage state", async () => {
    const state = join(outDir, "state.json");
    const host = new URL(baseUrl).hostname;
    writeFileSync(state, JSON.stringify({ cookies: [{ name: "session", value: "signed-in", domain: host, path: "/", expires: -1, httpOnly: true, secure: false, sameSite: "Lax" }], origins: [] }));
    const [anonymous] = await take([makeEntry({ id: "private-anonymous", path: "/private", expect: "Your dashboard" })]);
    expect(anonymous).toMatchObject({ ok: false, gate: "phrase" });
    const [signedIn] = await take([makeEntry({ id: "private-signed-in", path: "/private", expect: "Your dashboard", storageState: state })]);
    expect(signedIn?.ok).toBe(true);
  });

  const signInSteps: ShotStep[] = [
    { do: "fill", target: { kind: "label", label: "Email", exact: false, nth: null }, value: "demo@example.com" },
    { do: "fill", target: { kind: "label", label: "Password", exact: false, nth: null }, value: "s3cret" },
    { do: "check", target: { kind: "label", label: "I accept the terms", exact: false, nth: null } },
    { do: "click", target: { kind: "role", role: "button", name: "Sign in", exact: false, nth: null } },
  ];
  const signInPlan: SignInPlan = { path: "/login.html", steps: signInSteps, expect: "Your dashboard" };

  it("signs in once through the form and captures the signed-in entries in that session, the others without it", async () => {
    const results = await take(
      [
        makeEntry({ id: "dash", path: "/private", expect: "Balance 12,345 USD", signedIn: true }),
        makeEntry({ id: "dash-anonymous", path: "/private", expect: "Sign in first" }),
        makeEntry({ id: "dash-wide", path: "/private", expect: "Your dashboard", signedIn: true, width: 900 }),
      ],
      { signIn: signInPlan },
    );
    expect(results.map((result) => [result.name, result.ok])).toEqual([
      ["dash", true],
      ["dash-anonymous", true],
      ["dash-wide", true],
    ]);
  });

  it("refuses every signed-in shot when the sign-in fails, never naming the password, and still takes the others", async () => {
    const wrong: SignInPlan = { ...signInPlan, steps: signInSteps.map((step) => (step.do === "fill" && step.value === "s3cret" ? { ...step, value: "hunter2" } : step)) };
    const results = await take(
      [
        makeEntry({ id: "locked", path: "/private", expect: "Your dashboard", signedIn: true, colorSchemes: ["light", "dark"] }),
        makeEntry({ id: "public", path: "/plain.html", expect: "Almost empty" }),
      ],
      { signIn: wrong },
    );
    const message = 'after the sign-in steps, /login.html does not show "Your dashboard" within 15 s';
    expect(results).toEqual([
      { ok: false, id: "locked", name: "locked-light", gate: "sign-in", message },
      { ok: false, id: "locked", name: "locked-dark", gate: "sign-in", message },
      expect.objectContaining({ ok: true, name: "public" }),
    ]);
    expect(JSON.stringify(results)).not.toContain("hunter2");
  });

  it("refuses a sign-in whose phrase shows without any session", async () => {
    const [result] = await take([makeEntry({ id: "no-session", path: "/private", expect: "Your dashboard", signedIn: true })], {
      signIn: { path: "/fakelogin.html", steps: [{ do: "click", target: { kind: "role", role: "button", name: "Sign in", exact: false, nth: null } }], expect: "Your dashboard" },
    });
    expect(result).toEqual({
      ok: false,
      id: "no-session",
      name: "no-session",
      gate: "sign-in",
      message: 'the page shows "Your dashboard", but the browser holds no session (no cookie, no localStorage); pick a phrase only a signed-in page shows',
    });
  });

  it("refuses a sign-in step that cannot be done, naming it", async () => {
    const [result] = await take([makeEntry({ id: "bad-step", path: "/private", expect: "Your dashboard", signedIn: true })], {
      signIn: { ...signInPlan, steps: [{ do: "click", target: { kind: "testId", testId: "nowhere", nth: null } }] },
    });
    expect(result).toMatchObject({ ok: false, gate: "sign-in" });
    expect(result?.ok === false && result.message).toMatch(/^signIn\.steps\[0\] \(click\): locator\.click: Timeout 10000ms exceeded/);
  });

  it("does an entry's steps before the phrase gate reads the page", async () => {
    const [closed] = await take([makeEntry({ id: "closed", path: "/dashboard.html", expect: "Bonds fund" })]);
    expect(closed).toMatchObject({ ok: false, gate: "phrase" });
    const [opened] = await take([
      makeEntry({ id: "opened", path: "/dashboard.html", expect: "Bonds fund", steps: [{ do: "click", target: { kind: "text", text: "Components", exact: true, nth: null } }] }),
    ]);
    expect(opened?.ok).toBe(true);
  });

  it("refuses a shot whose step fails, as the steps gate, and writes no file", async () => {
    const [result] = await take([makeEntry({ id: "step-fails", path: "/plain.html", expect: "Almost empty", steps: [{ do: "click", target: { kind: "css", css: "#missing", hasText: null, nth: null } }] })]);
    expect(result).toMatchObject({ ok: false, gate: "steps" });
    expect(result?.ok === false && result.message).toMatch(/^steps\[0\] \(click\): locator\.click: Timeout 10000ms exceeded/);
    expect(existsSync(getScreenshotFile(outDir, "step-fails"))).toBe(false);
  }, 30_000);

  const chartCrop = { target: { kind: "css" as const, css: "#chart", hasText: null, nth: null }, aspect: { width: 4, height: 3 }, padding: 0, fill: false };

  it("crops an element far down the page to the aspect at the scale, under no sticky header", async () => {
    const [result] = await take([makeEntry({ id: "chart", path: "/crop.html", expect: "Portfolio chart", scale: 2, crop: chartCrop })]);
    expect(result).toMatchObject({ ok: true, name: "chart" });
    const file = getScreenshotFile(outDir, "chart");
    expect([readPngWidth(file), readPngHeight(file)]).toEqual([800, 600]);
    // The card's stripes start at its top-left corner; the sticky header (#222) would be there if it covered it.
    const [red, green, blue] = await readPixel(file, 2, 2);
    expect(red + green + blue).toBeGreaterThan(3 * 0x22 + 60);
  });

  it("frames the padding around the element", async () => {
    const [result] = await take([makeEntry({ id: "chart-padded", path: "/crop.html", expect: "Portfolio chart", crop: { ...chartCrop, aspect: { width: 1, height: 1 }, padding: 20 } })]);
    expect(result?.ok).toBe(true);
    const file = getScreenshotFile(outDir, "chart-padded");
    expect([readPngWidth(file), readPngHeight(file)]).toEqual([440, 440]);
  });

  it.each([
    ["no element", { kind: "css" as const, css: "#nowhere", hasText: null, nth: null }, "no element matches crop.target"],
    ["several elements", { kind: "css" as const, css: ".card", hasText: null, nth: null }, "crop.target matches 3 elements; add nth to pick one"],
  ])("refuses a crop target matching %s, as the crop gate", async (_case, target, message) => {
    const [result] = await take([makeEntry({ id: "crop-target", path: "/crop.html", expect: "Portfolio chart", crop: { ...chartCrop, target } })]);
    expect(result).toEqual({ ok: false, id: "crop-target", name: "crop-target", gate: "crop", message });
    expect(existsSync(getScreenshotFile(outDir, "crop-target"))).toBe(false);
  });

  it("takes the n-th of several matches, and refuses a frame that runs past the page's bottom", async () => {
    const [second] = await take([makeEntry({ id: "second-card", path: "/crop.html", expect: "Other card", crop: { ...chartCrop, aspect: { width: 2, height: 1 }, target: { kind: "css", css: ".card", hasText: null, nth: 1 } } })]);
    expect(second?.ok).toBe(true);
    const [past] = await take([makeEntry({ id: "past-bottom", path: "/crop.html", expect: "Last card", crop: { ...chartCrop, target: { kind: "css", css: "#last", hasText: null, nth: null } } })]);
    expect(past).toEqual({ ok: false, id: "past-bottom", name: "past-bottom", gate: "crop", message: "the 4:3 frame (400×300 px) runs 260 px past the page's bottom edge" });
  });

  it("refuses a file with the same bytes as an earlier file of the run, and deletes it", async () => {
    const results = await take([
      makeEntry({ id: "first-copy", path: "/plain.html", expect: "Almost empty" }),
      makeEntry({ id: "second-copy", path: "/plain.html?again", expect: "Almost empty" }),
      makeEntry({ id: "other", path: "/noise.html", expect: "Count your date" }),
    ]);
    expect(results.map((result) => [result.name, result.ok])).toEqual([
      ["first-copy", true],
      ["second-copy", false],
      ["other", true],
    ]);
    expect(results[1]).toEqual({
      ok: false,
      id: "second-copy",
      name: "second-copy",
      gate: "duplicate",
      message: "the file has the same bytes as first-copy.png: the page did not change between the two shots; deleted",
    });
    expect(existsSync(getScreenshotFile(outDir, "second-copy"))).toBe(false);
    expect(existsSync(getScreenshotFile(outDir, "first-copy"))).toBe(true);
  });

  const css = (selector: string, nth: number | null = null) => ({ kind: "css" as const, css: selector, hasText: null, nth });
  const cardCrop = { target: css("#card"), aspect: { width: 6, height: 5 }, padding: 0, fill: false };

  it("hides the entry's own selectors, and passes the hide gate when none shows in the frame", async () => {
    const [result] = await take([makeEntry({ id: "print-hidden", path: "/print.html", expect: "Your portfolio", hide: [".hint", ".outside"], crop: cardCrop })]);
    expect(result).toMatchObject({ ok: true, name: "print-hidden" });
  });

  it("refuses a shot whose hidden selector still shows an element in the frame, as the hide gate, and writes no file", async () => {
    const [result] = await take([makeEntry({ id: "print-stubborn", path: "/print.html", expect: "Your portfolio", hide: [".hint", ".stubborn"], crop: cardCrop })]);
    expect(result).toEqual({ ok: false, id: "print-stubborn", name: "print-stubborn", gate: "hide", message: 'hide ".stubborn" still shows 1 element in the frame' });
    expect(existsSync(getScreenshotFile(outDir, "print-stubborn"))).toBe(false);
  });

  it("gates the viewport without a crop, and refuses a hidden selector the browser cannot parse", async () => {
    const [viewport] = await take([makeEntry({ id: "print-viewport", path: "/print.html", expect: "Your portfolio", width: 400, height: 400, hide: [".stubborn"] })]);
    expect(viewport).toMatchObject({ ok: false, gate: "hide", message: 'hide ".stubborn" still shows 1 element in the frame' });
    const [unparsable] = await take([makeEntry({ id: "print-unparsable", path: "/print.html", expect: "Your portfolio", hide: ["button:bogus"], crop: cardCrop })]);
    expect(unparsable).toMatchObject({ ok: false, gate: "hide", message: 'hide "button:bogus" is not a selector the browser can parse' });
  });

  it("starts the frame at crop.top's top edge, as wide as crop.target", async () => {
    const [result] = await take([makeEntry({ id: "print-top", path: "/print.html", expect: "Total 12,345", scale: 2, crop: { ...cardCrop, top: css("#total-row") } })]);
    expect(result).toMatchObject({ ok: true, name: "print-top" });
    const file = getScreenshotFile(outDir, "print-top");
    expect([readPngWidth(file), readPngHeight(file)]).toEqual([716, 596]);
    // The total row is solid rgb(200, 30, 30) right of its text; the card's stripes would be there if the frame started at the card.
    const [red, green, blue] = await readPixel(file, 700, 20);
    expect([red > 150, green < 80, blue < 80]).toEqual([true, true, true]);
  });

  it("refuses a crop.top outside crop.target, as the crop gate", async () => {
    const [result] = await take([makeEntry({ id: "print-top-outside", path: "/print.html", expect: "Your portfolio", crop: { ...cardCrop, top: css(".outside") } })]);
    expect(result).toMatchObject({ ok: false, gate: "crop" });
    expect(result?.ok === false && result.message).toMatch(/^crop\.top's top edge lies \d+ px below crop\.target's bottom edge$/);
    const [missing] = await take([makeEntry({ id: "print-top-missing", path: "/print.html", expect: "Your portfolio", crop: { ...cardCrop, top: css("#nowhere") } })]);
    expect(missing).toMatchObject({ ok: false, gate: "crop", message: "no element matches crop.top" });
  });

  it("opens every matching <details> before the phrase gate reads the page", async () => {
    const [closed] = await take([makeEntry({ id: "print-closed", path: "/print.html", expect: "Cash fund", crop: cardCrop })]);
    expect(closed).toMatchObject({ ok: false, gate: "phrase" });
    const [opened] = await take([makeEntry({ id: "print-opened", path: "/print.html", expect: "Cash fund", steps: [{ do: "open", target: css("#card details") }], crop: cardCrop })]);
    expect(opened?.ok).toBe(true);
  });

  const railSteps: ShotStep[] = [
    { do: "hide", target: css("#rail > header"), keepLast: 0 },
    { do: "hide", target: css("#rail > div"), keepLast: 0 },
    { do: "hide", target: css("#rail > dl > div"), keepLast: 1 },
    { do: "flatten", target: css("#rail > dl") },
  ];
  const railCrop = { target: css("#rail"), aspect: { width: 6, height: 5 }, padding: 0, fill: false };

  it("frames a card shorter than its frame with the next card showing below it, without crop.fill", async () => {
    const [result] = await take([makeEntry({ id: "row-short", path: "/row.html", expect: "Change since last month", scale: 2, steps: railSteps, crop: railCrop })]);
    expect(result).toMatchObject({ ok: true, name: "row-short" });
    const [red, green, blue] = await readPixel(getScreenshotFile(outDir, "row-short"), 10, 590);
    expect([red > 150, green < 80, blue < 80]).toEqual([true, true, true]);
  });

  it("stretches the card to the frame with crop.fill and centres its last row, with no border above it", async () => {
    const [result] = await take([makeEntry({ id: "row-fill", path: "/row.html", expect: "Change since last month", scale: 2, steps: railSteps, crop: { ...railCrop, fill: true } })]);
    expect(result).toMatchObject({ ok: true, name: "row-fill" });
    const file = getScreenshotFile(outDir, "row-fill");
    expect([readPngWidth(file), readPngHeight(file)]).toEqual([716, 596]);
    // The card's own blue at the frame's bottom edge, the row's yellow in its middle, the card's blue just above the row.
    expect(await readPixel(file, 10, 590)).toEqual([20, 90, 200]);
    expect(await readPixel(file, 700, 298)).toEqual([250, 200, 0]);
    expect(await readPixel(file, 700, 232)).toEqual([20, 90, 200]);
  });

  it("refuses a crop.fill whose target cannot be stretched (an SVG), as the crop gate", async () => {
    const [result] = await take([makeEntry({ id: "row-capped", path: "/row.html", expect: "A drawing", crop: { ...railCrop, target: css("#drawing"), fill: true } })]);
    expect(result).toEqual({
      ok: false,
      id: "row-capped",
      name: "row-capped",
      gate: "crop",
      message: "crop.fill left crop.target 198 px short of the frame's bottom edge (it is not an HTML element, or a script reset its style)",
    });
    expect(existsSync(getScreenshotFile(outDir, "row-capped"))).toBe(false);
  });

  it("goes on after a failed entry", async () => {
    const results = await take([
      makeEntry({ id: "first-fails", path: "/missing.html", expect: "x" }),
      makeEntry({ id: "second-passes", path: "/plain.html", expect: "Almost empty" }),
    ]);
    expect(results.map((result) => result.ok)).toEqual([false, true]);
  });
});

describe.runIf(hasChromium)("the open and hide steps", () => {
  let browser: Browser;
  let page: Page;

  beforeAll(async () => {
    browser = await chromium.launch(CHROMIUM_PATH === undefined ? {} : { executablePath: CHROMIUM_PATH });
  });

  afterAll(async () => {
    await browser.close();
  });

  beforeEach(async () => {
    page = await browser.newPage();
    await page.setContent(readFileSync(join(PAGES, "print.html"), "utf8"));
  });

  afterEach(async () => {
    await page.close();
  });

  const css = (selector: string, nth: number | null = null) => ({ kind: "css" as const, css: selector, hasText: null, nth });
  const readOpen = () => page.locator("#card details").evaluateAll((nodes) => nodes.map((node) => (node as HTMLDetailsElement).open));
  const readShownColumns = () => page.locator(".col").evaluateAll((nodes) => nodes.filter((node) => getComputedStyle(node).display !== "none").map((node) => node.textContent));

  it("opens every match, or only the n-th with nth", async () => {
    expect(await runShotSteps(page, [{ do: "open", target: css("#card details", 1) }], "steps")).toBeNull();
    expect(await readOpen()).toEqual([false, true, false]);
    expect(await runShotSteps(page, [{ do: "open", target: css("#card details") }], "steps")).toBeNull();
    expect(await readOpen()).toEqual([true, true, true]);
  });

  it("refuses to open a match that is not a <details>, and details of one exclusive group that cannot all stay open", async () => {
    expect(await runShotSteps(page, [{ do: "open", target: css("#card details, #card .chart") }], "steps")).toBe("steps[0] (open): 1 of 4 matches is not a <details> element");
    expect(await runShotSteps(page, [{ do: "open", target: css("details[name=faq]") }], "steps")).toBe(
      "steps[0] (open): 1 of 2 <details> did not stay open (details sharing a name show one at a time)",
    );
  });

  it("hides every match but the last keepLast, with !important", async () => {
    expect(await runShotSteps(page, [{ do: "hide", target: css(".col"), keepLast: 3 }], "steps")).toBeNull();
    expect(await readShownColumns()).toEqual(["Apr", "May", "Jun"]);
    expect(await page.locator(".col").first().getAttribute("style")).toBe("display: none !important;");
  });

  it("hides every match without keepLast, and refuses a keepLast that leaves nothing to hide", async () => {
    expect(await runShotSteps(page, [{ do: "hide", target: css(".footnote"), keepLast: 0 }], "steps")).toBeNull();
    expect(await page.locator(".footnote").isVisible()).toBe(false);
    expect(await runShotSteps(page, [{ do: "hide", target: css(".col"), keepLast: 6 }], "steps")).toBe("steps[0] (hide): matches 6 elements, not more than keepLast 6, so nothing would be hidden");
  });

  it("flattens every match: no top border and no top margin, with !important", async () => {
    await page.addStyleTag({ content: ".chart { margin-top: 8px; border-top: 2px solid red; }" });
    expect(await runShotSteps(page, [{ do: "flatten", target: css(".chart") }], "steps")).toBeNull();
    const style = await page.locator(".chart").evaluate((node) => [getComputedStyle(node).borderTopStyle, getComputedStyle(node).marginTop]);
    expect(style).toEqual(["none", "0px"]);
  });

  it("refuses an open or hide step whose target never appears", async () => {
    expect(await runShotSteps(page, [{ do: "hide", target: css("#nowhere"), keepLast: 0 }], "steps")).toMatch(/^steps\[0\] \(hide\): locator\.waitFor: Timeout 10000ms exceeded/);
  }, 30_000);
});
