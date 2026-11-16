import { describe, expect, it } from "vitest";
import { defineModule, defineSoftureConfig, getModuleRuntimes, resolvePlatform, toModuleJson } from "@softure-ai/core";
import { catchConfigError, createTestModule } from "./support.js";

const base = { locale: "en", timezone: "Europe/Warsaw", appOrigin: "https://app.example.com", modules: [] } as const;

describe("resolvePlatform", () => {
  it("defaults to node on a vps", () => {
    expect(resolvePlatform(undefined)).toEqual({ ok: true, platform: { runtime: "node", host: "vps" } });
    expect(resolvePlatform({})).toEqual({ ok: true, platform: { runtime: "node", host: "vps" } });
  });

  it("takes the runtime from the host when only the host is named", () => {
    expect(resolvePlatform({ host: "cloudflare" })).toEqual({ ok: true, platform: { runtime: "workers", host: "cloudflare" } });
  });

  it("refuses a pair no host supports and lists the supported ones", () => {
    expect(resolvePlatform({ host: "vps", runtime: "workers" })).toEqual({
      ok: false,
      reason: "the vps host does not run the workers runtime (supported: vps+node, cloudflare+workers)",
    });
    expect(resolvePlatform({ runtime: "workers" })).toMatchObject({ ok: false });
  });
});

describe("platform in defineSoftureConfig", () => {
  it("keeps the platform frozen in the config", () => {
    const config = defineSoftureConfig({ ...base, platform: { host: "cloudflare", runtime: "workers" } });
    expect(config.platform).toEqual({ runtime: "workers", host: "cloudflare" });
    expect(Object.isFrozen(config.platform)).toBe(true);
  });

  it("reports an unsupported pair under platform", () => {
    const error = catchConfigError(() => defineSoftureConfig({ ...base, platform: { host: "cloudflare", runtime: "node" } }));
    expect(error.issues).toEqual(["platform: the cloudflare host does not run the node runtime (supported: vps+node, cloudflare+workers)"]);
  });

  it("reports an unknown host or key", () => {
    expect(catchConfigError(() => defineSoftureConfig({ ...base, platform: { host: "azure" } as never })).issues).toEqual([
      expect.stringMatching(/^platform\.host: /),
    ]);
    expect(catchConfigError(() => defineSoftureConfig({ ...base, platform: { region: "eu" } as never })).issues).toEqual([
      expect.stringMatching(/^platform: /),
    ]);
  });

  it("refuses a module that does not declare the workers runtime, naming it", () => {
    const modules = [createTestModule({ id: "ready", runtimes: ["node", "workers"] }), createTestModule({ id: "legacy" })];
    const error = catchConfigError(() => defineSoftureConfig({ ...base, platform: { host: "cloudflare" }, modules }));
    expect(error.issues).toEqual(['modules.1: module "legacy" does not run on the workers runtime (it supports: node)']);
  });

  it("accepts every module on node, whatever it declares", () => {
    const modules = [createTestModule({ id: "legacy" }), createTestModule({ id: "both", runtimes: ["workers", "node"] })];
    expect(defineSoftureConfig({ ...base, modules }).modules.map((module) => module.id)).toEqual(["legacy", "both"]);
  });

  it("refuses a workers-only module on node", () => {
    const error = catchConfigError(() => defineSoftureConfig({ ...base, modules: [createTestModule({ id: "edge", runtimes: ["workers"] })] }));
    expect(error.issues).toEqual(['modules.0: module "edge" does not run on the node runtime (it supports: workers)']);
  });
});

describe("runtimes in the module manifest", () => {
  it("reads as node only when absent and stays out of module.json", () => {
    const module = createTestModule({ id: "legacy" });
    expect(getModuleRuntimes(module.manifest)).toEqual(["node"]);
    expect(toModuleJson(module)).not.toHaveProperty("runtimes");
  });

  it.each([
    ["empty", []],
    ["repeated", ["node", "node"]],
    ["unknown", ["deno"]],
  ])("rejects a %s list", (_name, runtimes) => {
    const manifest = { ...createTestModule({ id: "bad" }).manifest, runtimes } as never;
    expect(() => defineModule({ manifest, messages: { en: { title: "T" }, pl: { title: "T" } } })).toThrow(/runtimes/);
  });
});
