import { afterEach, describe, expect, it } from "vitest";
import { defineSoftureConfig } from "@softure-ai/core";
import { clearSoftureConfig, getSoftureConfig, registerSoftureConfig } from "@softure-ai/core/next";

const config = defineSoftureConfig({ locale: "en", timezone: "UTC", appOrigin: "https://app.example.com", modules: [] });

afterEach(() => {
  clearSoftureConfig();
});

describe("the config registry", () => {
  it("throws a message naming the fix before a config is registered", () => {
    expect(() => getSoftureConfig()).toThrow("registerSoftureConfig(config)");
  });

  it("returns the registered config", () => {
    registerSoftureConfig(config);
    expect(getSoftureConfig()).toBe(config);
  });

  it("replaces an earlier registration (dev reloads re-run softure.config.ts)", () => {
    registerSoftureConfig(config);
    const next = defineSoftureConfig({ ...config, locale: "pl" });
    registerSoftureConfig(next);
    expect(getSoftureConfig()).toBe(next);
  });

  it("shares the config through globalThis, so a second copy of the package sees it", () => {
    (globalThis as Record<symbol, unknown>)[Symbol.for("@softure-ai/core/config")] = config;
    expect(getSoftureConfig()).toBe(config);
  });
});
