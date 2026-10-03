import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { loadMarketingConfig } from "../src/config/config.js";

const VALID = {
  locale: "en",
  brand: { name: "Acme Plan" },
  app: { baseUrl: "http://localhost:3000", path: "/calculator", port: 3100, startCommand: ["npx", "next", "dev", "-p", "{port}"] },
  siteCss: "../src/app/globals.css",
  posts: { site: "https://example.com/calculator" },
  paths: { films: "films", voiceover: "voiceover", build: "build", out: "out", fonts: "assets/fonts", sfx: "assets/sfx" },
};

describe("loadMarketingConfig", () => {
  let dir: string;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "marketing-config-"));
    mkdirSync(join(dir, "video"));
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  function write(config: unknown): string {
    const file = join(dir, "video", "marketing.config.json");
    writeFileSync(file, JSON.stringify(config));
    return file;
  }

  it("resolves every path against the config file's folder, not the current directory", () => {
    const result = loadMarketingConfig(write(VALID));
    expect(result.ok && result.config.paths).toEqual({
      films: join(dir, "video", "films"),
      voiceover: join(dir, "video", "voiceover"),
      build: join(dir, "video", "build"),
      out: join(dir, "video", "out"),
      fonts: join(dir, "video", "assets", "fonts"),
      sfx: join(dir, "video", "assets", "sfx"),
    });
    expect(result.ok && result.config.siteCss).toBe(join(dir, "src", "app", "globals.css"));
    expect(result.ok && result.config.root).toBe(join(dir, "video"));
  });

  it("builds the recorded page's URLs and puts the port into the start command", () => {
    const result = loadMarketingConfig(write(VALID));
    expect(result.ok && result.config.app).toEqual({
      url: "http://localhost:3000/calculator",
      ownUrl: "http://localhost:3100/calculator",
      port: 3100,
      startCommand: ["npx", "next", "dev", "-p", "3100"],
    });
  });

  it("names the JSON path of a wrong type and of an unknown key", () => {
    const result = loadMarketingConfig(write({ ...VALID, app: { ...VALID.app, port: "3100" }, extra: true }));
    expect(result.ok).toBe(false);
    expect(!result.ok && result.error).toMatch(/app\.port:/);
    expect(!result.ok && result.error).toMatch(/extra/);
  });

  it("refuses a locale without a dictionary", () => {
    const result = loadMarketingConfig(write({ ...VALID, locale: "de" }));
    expect(!result.ok && result.error).toMatch(/locale:/);
  });

  it("refuses an empty start command", () => {
    const result = loadMarketingConfig(write({ ...VALID, app: { ...VALID.app, startCommand: [] } }));
    expect(!result.ok && result.error).toMatch(/app\.startCommand:/);
  });

  it("reports a missing file with its path", () => {
    const result = loadMarketingConfig(join(dir, "nope.json"));
    expect(!result.ok && result.error).toBe(`Reading the marketing config ${join(dir, "nope.json")}: ENOENT.`);
  });

  it("reports a file that is not JSON", () => {
    const file = join(dir, "broken.json");
    writeFileSync(file, "{");
    const result = loadMarketingConfig(file);
    expect(!result.ok && result.error).toMatch(/not JSON/);
  });
});
