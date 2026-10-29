import { createServer, type Server, type ServerResponse } from "node:http";
import type { AddressInfo } from "node:net";
import { chromium, type Browser, type BrowserContext, type Page } from "@playwright/test";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  emulateInstalledApp,
  emulateSafeAreaInsets,
  expectClearOfSafeAreaInsets,
  expectLoadWithin,
  expectTouchTargets,
  expectWorksOffline,
  IPHONE_SAFE_AREA,
  PHONE_CPU_SLOWDOWN,
  PHONE_NETWORK_PROFILES,
  throttleLikePhone,
} from "@softure-ai/testing/playwright";
import { CHROMIUM_PATH, hasChromium } from "./chromium.js";

// A tiny installable app: standalone styles in inline, linked and late style sheets, fixed bars that
// keep (or break) the safe area, a service worker with a kept page and an offline page, and controls
// of several sizes.

const VIEWPORT_META = `<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">`;

const INSTALLED_PAGE = `<style>
  #inline { color: rgb(255, 0, 0); }
  @media (display-mode: standalone) { #inline { color: rgb(0, 0, 255); } }
  @supports (display: block) { @media screen and (display-mode: browser) { #nested { color: rgb(0, 128, 0); } } }
</style>
<link rel="stylesheet" href="/standalone.css">
<p id="inline">inline</p><p id="nested">nested</p><p id="linked">linked</p><p id="late">late</p>
<script>
  const style = document.createElement("style");
  style.textContent = "@media (display-mode: standalone) { #late { color: rgb(0, 0, 255); } }";
  setTimeout(() => document.head.append(style), 50);
</script>`;

const STANDALONE_CSS = "@media (display-mode: standalone) { #linked { color: rgb(0, 0, 255); } }";

function renderSafeAreaPage(isBroken: boolean): string {
  const headerPadding = isBroken ? "0" : "env(safe-area-inset-top)";
  const barPadding = isBroken ? "0" : "env(safe-area-inset-bottom)";
  return `${VIEWPORT_META}<style>
    body { margin: 0; background: white; color: black; }
    @media (prefers-color-scheme: dark) { body { background: black; color: white; } }
    header { position: fixed; top: 0; left: 0; right: 0; padding-top: ${headerPadding}; }
    nav { position: fixed; bottom: 0; left: 0; right: 0; padding-bottom: ${barPadding}; }
    .dark-only { display: none; position: fixed; top: ${headerPadding}; left: 0; }
    @media (prefers-color-scheme: dark) { .dark-only { display: block; } }
    button { height: 44px; }
  </style>
  <header><button>Menu</button></header>
  <button class="dark-only">Theme</button>
  <main style="padding: 100px 16px">Content</main>
  <nav><button>Home</button></nav>`;
}

const OFFLINE_APP = `<h1>Kept page</h1><script>navigator.serviceWorker.register("/sw.js");</script>`;
const LAZY_WORKER_APP = `<h1>Lazy page</h1><script>navigator.serviceWorker.register("/lazy-sw.js");</script>`;

// Caches the app shell and the offline page; answers from the network first, then the cache, then the offline page.
function renderWorker(claimsClients: boolean): string {
  return `const CACHE = "app-v1";
self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(["/offline-app", "/lazy-app", "/offline-page"])).then(() => self.skipWaiting()));
});
self.addEventListener("activate", (event) => { ${claimsClients ? "event.waitUntil(self.clients.claim());" : ""} });
self.addEventListener("fetch", (event) => {
  event.respondWith(
    fetch(event.request).catch(() => caches.match(event.request).then((hit) => hit ?? caches.match("/offline-page")))
  );
});`;
}

const TOUCH_PAGE = `<style>button, a { display: inline-block; box-sizing: border-box; }</style>
<section id="good"><button style="width: 44px; height: 44px">A</button><a href="/x" style="width: 48px; height: 48px">B</a></section>
<section id="bad"><button style="width: 44px; height: 44px">Big</button><button style="width: 24px; height: 24px" aria-label="Close">x</button>
<a href="/y" style="width: 120px; height: 20px">Small link</a><button style="display: none">Hidden</button><input type="hidden" name="token"></section>`;

let server: Server;
let baseURL: string;
let browser: Browser;

function send(response: ServerResponse, status: number, type: string, body: string): void {
  response.writeHead(status, { "content-type": type, "cache-control": "no-store" });
  response.end(body);
}

function sendHtml(response: ServerResponse, body: string): void {
  send(response, 200, "text/html; charset=utf-8", `<!doctype html><html><head></head><body>${body}</body></html>`);
}

beforeAll(async () => {
  server = createServer((request, response) => {
    const url = new URL(request.url ?? "/", "http://localhost");
    switch (url.pathname) {
      case "/installed":
        return sendHtml(response, INSTALLED_PAGE);
      case "/standalone.css":
        return send(response, 200, "text/css", STANDALONE_CSS);
      case "/safe-area":
        return sendHtml(response, renderSafeAreaPage(url.searchParams.has("broken")));
      case "/phone":
        return sendHtml(response, `<h1>Phone</h1><p>${"x".repeat(20_000)}</p>`);
      case "/offline-app":
        return sendHtml(response, OFFLINE_APP);
      case "/lazy-app":
        return sendHtml(response, LAZY_WORKER_APP);
      case "/offline-page":
        return sendHtml(response, "<h1>You are offline</h1>");
      case "/no-worker":
        return sendHtml(response, "<h1>No worker</h1>");
      case "/sw.js":
        return send(response, 200, "text/javascript", renderWorker(true));
      case "/lazy-sw.js":
        return send(response, 200, "text/javascript", renderWorker(false));
      case "/touch":
        return sendHtml(response, TOUCH_PAGE);
      default:
        return send(response, 404, "text/html", "<h1>Not found</h1>");
    }
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  baseURL = `http://127.0.0.1:${String((server.address() as AddressInfo).port)}`;
  if (hasChromium) browser = await chromium.launch({ executablePath: CHROMIUM_PATH });
});

afterAll(async () => {
  await browser?.close();
  await new Promise<void>((resolve) => server.close(() => resolve()));
});

async function withPage(work: (page: Page, context: BrowserContext) => Promise<void>, options: Parameters<Browser["newContext"]>[0] = {}): Promise<void> {
  const context = await browser.newContext({ baseURL, ...options });
  try {
    await work(await context.newPage(), context);
  } finally {
    await context.close();
  }
}

const colorOf = (page: Page, id: string) => page.locator(`#${id}`).evaluate((element) => getComputedStyle(element).color);

describe("phone profiles", () => {
  it("match the Chrome DevTools presets and Lighthouse's CPU slowdown", () => {
    expect(PHONE_NETWORK_PROFILES.FAST_4G).toEqual({ latencyMs: 165, downloadThroughput: 1_012_500, uploadThroughput: 168_750 });
    expect(PHONE_NETWORK_PROFILES.SLOW_4G).toEqual({ latencyMs: 562.5, downloadThroughput: 180_000, uploadThroughput: 84_375 });
    expect(PHONE_CPU_SLOWDOWN).toBe(4);
  });
});

describe.skipIf(!hasChromium)("PWA helpers in a browser", () => {
  it("makes the page an installed app: navigator.standalone, matchMedia and every same-origin style sheet", async () => {
    await withPage(async (page, context) => {
      await emulateInstalledApp(context);
      await page.goto("/installed");
      await expect(page.evaluate(() => (navigator as Navigator & { standalone?: boolean }).standalone)).resolves.toBe(true);
      await expect(page.evaluate(() => [matchMedia("(display-mode: standalone)").matches, matchMedia("(display-mode: browser)").matches])).resolves.toEqual([true, false]);
      await expect(colorOf(page, "inline")).resolves.toBe("rgb(0, 0, 255)");
      await expect(colorOf(page, "nested")).resolves.toBe("rgb(0, 0, 0)");
      await expect(colorOf(page, "linked")).resolves.toBe("rgb(0, 0, 255)");
      await page.waitForFunction(() => getComputedStyle(document.getElementById("late") as Element).color === "rgb(0, 0, 255)");
    });
  });

  it("leaves a page without the emulation in the browser display mode", async () => {
    await withPage(async (page) => {
      await page.goto("/installed");
      await expect(page.evaluate(() => (navigator as Navigator & { standalone?: boolean }).standalone)).resolves.toBeUndefined();
      await expect(colorOf(page, "inline")).resolves.toBe("rgb(255, 0, 0)");
      await expect(colorOf(page, "nested")).resolves.toBe("rgb(0, 128, 0)");
    });
  });

  it("sets the safe-area insets and passes bars that keep clear of them in light and dark", async () => {
    await withPage(
      async (page) => {
        await emulateSafeAreaInsets(page, IPHONE_SAFE_AREA.insets);
        await page.goto("/safe-area");
        await expect(page.locator("header").evaluate((element) => getComputedStyle(element).paddingTop)).resolves.toBe("47px");
        await expectClearOfSafeAreaInsets(page.getByRole("button"), IPHONE_SAFE_AREA.insets);
      },
      { viewport: IPHONE_SAFE_AREA.viewport },
    );
  });

  it("names every control inside an inset band, with the scheme it was seen in", async () => {
    await withPage(
      async (page) => {
        await emulateSafeAreaInsets(page, IPHONE_SAFE_AREA.insets);
        await page.goto("/safe-area?broken");
        const failure = await expectClearOfSafeAreaInsets(page.getByRole("button"), IPHONE_SAFE_AREA.insets).then(
          () => "passed",
          (error: unknown) => String(error),
        );
        expect(failure).toContain('<button> "Menu" at 0,0 overlaps the top inset (light)');
        expect(failure).toContain('<button> "Home" at 0,800 overlaps the bottom inset (dark)');
        expect(failure).toContain('<button> "Theme" at 0,0 overlaps the top inset (dark)');
        expect(failure).not.toContain('"Theme" at 0,0 overlaps the top inset (light)');
        await expect(page.evaluate(() => matchMedia("(prefers-color-scheme: dark)").matches)).resolves.toBe(false);
      },
      { viewport: IPHONE_SAFE_AREA.viewport },
    );
  });

  it("throttles like a phone, measures the load against a budget and releases the throttle", async () => {
    await withPage(async (page, context) => {
      const throttle = await throttleLikePhone(context, page, "SLOW_4G");
      const throttledMs = await expectLoadWithin(page, "/phone", 30_000);
      expect(throttledMs).toBeGreaterThanOrEqual(562);
      await expect(expectLoadWithin(page, "/phone", 100)).rejects.toThrow(/\/phone reached load in \d+ ms, over the 100 ms budget/);
      await throttle.release();
      await expect(expectLoadWithin(page, "/phone", 500, { event: "domcontentloaded" })).resolves.toBeLessThan(562);
    });
  });

  it("refuses a page of another context", async () => {
    await withPage(async (page) => {
      const other = await browser.newContext();
      await expect(throttleLikePhone(other, page)).rejects.toThrow("throttleLikePhone: the page belongs to another context");
      await other.close();
    });
  });

  it("reloads the kept page offline once the worker took control", async () => {
    await withPage(async (page, context) => {
      await expectWorksOffline(page, { path: "/offline-app", answer: page.getByRole("heading", { name: "Kept page" }) });
      // The context is back online afterwards.
      await expect(page.evaluate(() => navigator.onLine)).resolves.toBe(true);
      expect(context.pages()).toHaveLength(1);
    });
  });

  it("opens the offline page for a path never visited, after a reload for a worker that does not claim its page", async () => {
    await withPage(async (page) => {
      await expectWorksOffline(page, {
        path: "/lazy-app",
        offlinePath: "/never-visited",
        answer: page.getByRole("heading", { name: "You are offline" }),
      });
    });
  });

  it("fails naming the path when no worker takes control, and comes back online after a failed answer", async () => {
    await withPage(async (page) => {
      await expect(expectWorksOffline(page, { path: "/no-worker", answer: page.getByRole("heading"), timeout: 500 })).rejects.toThrow(
        "expectWorksOffline: no service worker took control of /no-worker within 500 ms",
      );
    });
    await withPage(async (page) => {
      const answer = page.getByRole("heading", { name: "Not there" });
      await expect(expectWorksOffline(page, { path: "/offline-app", answer })).rejects.toThrow(/offline answer of \/offline-app/);
      await expect(page.evaluate(() => navigator.onLine)).resolves.toBe(true);
    });
  }, 15_000);

  it("passes controls at the touch target and lists every smaller one with its size", async () => {
    await withPage(async (page) => {
      await page.goto("/touch");
      await expectTouchTargets(page.locator("#good"));
      const failure = await expectTouchTargets(page.locator("#bad")).then(
        () => "passed",
        (error: unknown) => String(error),
      );
      expect(failure).toContain('<button> "Close" is 24 × 24 px');
      expect(failure).toContain('<a> "Small link" is 120 × 20 px');
      expect(failure).not.toContain("Big");
      expect(failure).not.toContain("Hidden");
      await expectTouchTargets(page.locator("#bad"), { minSize: 20, controls: page.locator("#bad a") });
    });
  });
});
