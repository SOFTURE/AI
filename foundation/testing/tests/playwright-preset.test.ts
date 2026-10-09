import { execFile } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { join } from "node:path";
import { promisify } from "node:util";
import { chromium } from "@playwright/test";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { CLIENT_ADDRESS_HEADER, hostResolverRules, softurePlaywrightUse } from "@softure-ai/testing/playwright";
import { CHROMIUM_PATH, hasChromium } from "./chromium.js";

const PACKAGE_DIR = join(import.meta.dirname, "..");
const REPO_ROOT = join(PACKAGE_DIR, "../..");
const run = promisify(execFile);

/** Answers every request with the headers it came with, as JSON. */
function startEchoServer(): Promise<Server> {
  const server = createServer((request, response) => {
    response.writeHead(200, { "content-type": "application/json" });
    response.end(JSON.stringify(request.headers));
  });
  return new Promise((resolve) => server.listen(0, "127.0.0.1", () => resolve(server)));
}

function portOf(server: Server): number {
  return (server.address() as AddressInfo).port;
}

describe("softurePlaywrightUse", () => {
  const savedPath = process.env.PLAYWRIGHT_CHROMIUM_PATH;
  afterEach(() => {
    if (savedPath === undefined) delete process.env.PLAYWRIGHT_CHROMIUM_PATH;
    else process.env.PLAYWRIGHT_CHROMIUM_PATH = savedPath;
  });

  it("blocks the hosts with host resolver rules", () => {
    delete process.env.PLAYWRIGHT_CHROMIUM_PATH;
    expect(softurePlaywrightUse({ blockHosts: ["example.com", "*.example.com"] })).toEqual({
      launchOptions: { args: ["--host-resolver-rules=MAP example.com ~NOTFOUND, MAP *.example.com ~NOTFOUND"] },
    });
  });

  it("launches the Chromium in PLAYWRIGHT_CHROMIUM_PATH, or the one it is given", () => {
    process.env.PLAYWRIGHT_CHROMIUM_PATH = "/opt/chrome";
    expect(softurePlaywrightUse()).toEqual({ launchOptions: { executablePath: "/opt/chrome", args: [] } });
    expect(softurePlaywrightUse({ chromiumPath: "/usr/bin/chromium" }).launchOptions?.executablePath).toBe("/usr/bin/chromium");
    process.env.PLAYWRIGHT_CHROMIUM_PATH = "";
    expect(softurePlaywrightUse()).toEqual({ launchOptions: { args: [] } });
  });

  it("refuses something that is not a host name, which would break the flag", () => {
    expect(() => hostResolverRules(["example.com, MAP *"])).toThrow(RangeError);
    expect(() => hostResolverRules(["https://example.com"])).toThrow(/blockHosts/);
  });
});

describe.skipIf(!hasChromium)("blocked hosts in Chromium", () => {
  let server: Server;
  beforeAll(async () => {
    server = await startEchoServer();
  });
  afterAll(() => new Promise<void>((resolve) => server.close(() => resolve())));

  it("cannot reach a blocked host and still reaches the others", async () => {
    const { launchOptions } = softurePlaywrightUse({ blockHosts: ["localhost"], chromiumPath: CHROMIUM_PATH });
    const browser = await chromium.launch(launchOptions);
    try {
      const blocked = await browser.newPage();
      await expect(blocked.goto(`http://localhost:${String(portOf(server))}/`)).rejects.toThrow(/ERR_NAME_NOT_RESOLVED/);
      const allowed = await browser.newPage();
      expect((await allowed.goto(`http://127.0.0.1:${String(portOf(server))}/`))?.status()).toBe(200);
    } finally {
      await browser.close();
    }
  });
});

describe.skipIf(!hasChromium)("test with a client address per test", () => {
  let server: Server;
  let dir: string;
  beforeAll(async () => {
    server = await startEchoServer();
    // Inside the package, so the spec resolves @playwright/test from the repository.
    dir = mkdtempSync(join(PACKAGE_DIR, ".playwright-app-"));
    writeFileSync(
      join(dir, "playwright.config.ts"),
      [
        'import { defineConfig } from "@playwright/test";',
        'import { softurePlaywrightUse } from "../src/playwright/preset.ts";',
        "export default defineConfig({",
        '  testDir: ".",',
        "  workers: 1,",
        '  reporter: "line",',
        "  use: { ...softurePlaywrightUse(), baseURL: process.env.ECHO_URL, extraHTTPHeaders: { \"x-from-config\": \"kept\" } },",
        "});",
      ].join("\n"),
    );
    writeFileSync(
      join(dir, "address.spec.ts"),
      [
        'import { expect, test } from "../src/playwright/test.ts";',
        "",
        "for (const name of [\"first\", \"second\"]) {",
        "  test(name, async ({ page, request, clientAddress }) => {",
        '    const fromRequest = (await (await request.get("/api")).json()) as Record<string, string>;',
        '    await page.goto("/page");',
        '    const fromPage = JSON.parse((await page.locator("body").textContent()) ?? "{}") as Record<string, string>;',
        `    expect(fromRequest["${CLIENT_ADDRESS_HEADER}"]).toBe(clientAddress);`,
        `    expect(fromPage["${CLIENT_ADDRESS_HEADER}"]).toBe(clientAddress);`,
        '    expect(fromRequest["x-from-config"]).toBe("kept");',
        '    expect(fromPage["x-from-config"]).toBe("kept");',
        "    console.log(`address ${name} ${clientAddress}`);",
        "  });",
        "}",
      ].join("\n"),
    );
  });
  afterAll(async () => {
    rmSync(dir, { recursive: true, force: true });
    await new Promise<void>((resolve) => server.close(() => resolve()));
  });

  it("sends a fresh address from page and request in every test, on top of the configured headers", async () => {
    const env = { ...process.env, ECHO_URL: `http://127.0.0.1:${String(portOf(server))}`, PLAYWRIGHT_CHROMIUM_PATH: CHROMIUM_PATH ?? "" };
    const { stdout } = await run(join(REPO_ROOT, "node_modules/.bin/playwright"), ["test", "--config", join(dir, "playwright.config.ts")], { cwd: dir, env });
    const addresses = [...stdout.matchAll(/address (?:first|second) (198\.1[89]\.\d+\.\d+)/g)].map((match) => match[1]);
    expect(stdout).toMatch(/2 passed/);
    expect(addresses).toHaveLength(2);
    expect(addresses[0]).not.toBe(addresses[1]);
  });
});
