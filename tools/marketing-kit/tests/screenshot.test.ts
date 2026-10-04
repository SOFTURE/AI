import { mkdirSync, readFileSync, rmSync, writeFileSync, existsSync, mkdtempSync } from "node:fs";
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { findSizeFailure, findStatusFailure } from "../src/screenshot/gates.js";
import { getScreenshotShots } from "../src/config/screenshot-names.js";
import { getScreenshotFile, takeScreenshots, type ScreenshotEntry, type TakeScreenshotsOptions } from "../src/screenshot/screenshot.js";
import { CHROMIUM_PATH, hasChromium } from "./chromium.js";

const PAGES = join(import.meta.dirname, "fixtures", "screenshots");

function makeEntry(overrides: Partial<ScreenshotEntry> & Pick<ScreenshotEntry, "id" | "path" | "expect">): ScreenshotEntry {
  return { width: 800, height: 600, full: false, motion: "reduce", minBytes: 0, scale: 1, ...overrides };
}

/** Height of a PNG from its IHDR chunk. */
function readPngHeight(file: string): number {
  return readFileSync(file).readUInt32BE(20);
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
      makeEntry({ id: "dark", path: "/motion.html", expect: "Scheme dark" }),
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

  it("goes on after a failed entry", async () => {
    const results = await take([
      makeEntry({ id: "first-fails", path: "/missing.html", expect: "x" }),
      makeEntry({ id: "second-passes", path: "/plain.html", expect: "Almost empty" }),
    ]);
    expect(results.map((result) => result.ok)).toEqual([false, true]);
  });
});
