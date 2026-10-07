// The module definition: its manifest, its options and the constraints of its table.
import { readFileSync } from "node:fs";
import { auth } from "@softure-ai/auth";
import { defineSoftureConfig, toModuleJson } from "@softure-ai/core";
import { featureSwitches, getSwitchEnvName } from "@softure-ai/feature-switches";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createConfig, createTestSwitches, NOW, type TestSwitches } from "./support.js";

describe("the feature-switches module", () => {
  it("ships a module.json equal to its manifest", () => {
    const moduleJson: unknown = JSON.parse(readFileSync(new URL("../module.json", import.meta.url), "utf8"));
    expect(moduleJson).toEqual(toModuleJson(featureSwitches));
  });

  it("keeps the package version and the manifest version in step", () => {
    const manifest = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8")) as { version: string };
    expect(featureSwitches.manifest.version).toBe(manifest.version);
  });

  it("fills in the defaults: no switches, the admin role, fail closed, overrides both ways", () => {
    expect(featureSwitches().options).toEqual({ switches: [], panelRole: "admin" });
    expect(featureSwitches({ switches: [{ name: "app.beta", default: true }] }).options.switches).toEqual([
      { name: "app.beta", default: true, failMode: "closed", override: "both" },
    ]);
  });

  it("refuses definitions it cannot run with, listing every problem", () => {
    expect(() =>
      featureSwitches({
        switches: [
          { name: "Billing.Checkout", default: false },
          { name: "app.beta", default: true },
          { name: "app.beta", default: false },
          { name: "my-app.beta", default: false },
          { name: "my.app_beta", default: false },
          // @ts-expect-error: a JavaScript config can omit the default, which must be explicit.
          { name: "app.no_default" },
          // @ts-expect-error: and can pass a fail mode that does not exist.
          { name: "app.bad_mode", default: false, failMode: "ajar" },
        ],
        panelRole: "Admin",
      }),
    ).toThrow(
      [
        'Invalid SOFTURE configuration in module "feature-switches":',
        "- options.switches.0.name: must be <scope>.<key>, e.g. billing.checkout_enabled",
        "- options.switches.5.default: Invalid input: expected boolean, received undefined",
        '- options.switches.6.failMode: Invalid option: expected one of "open"|"closed"',
        "- options.panelRole: must be a role name such as admin",
      ].join("\n"),
    );
  });

  it("refuses a switch declared twice and two switches with the same environment override", () => {
    expect(() =>
      featureSwitches({
        switches: [
          { name: "app.beta", default: true },
          { name: "app.beta", default: false },
          { name: "my-app.beta", default: false },
          { name: "my.app_beta", default: false },
        ],
      }),
    ).toThrow(
      [
        'Invalid SOFTURE configuration in module "feature-switches":',
        '- options.switches.1.name: "app.beta" is declared twice',
        '- options.switches.3.name: its environment override SOFTURE_SWITCH_MY_APP_BETA is also the one of "my-app.beta"',
      ].join("\n"),
    );
  });

  it("refuses a name longer than the table allows", () => {
    expect(() => featureSwitches({ switches: [{ name: `app.${"x".repeat(97)}`, default: false }] })).toThrow(
      "options.switches.0.name: must be at most 100 characters",
    );
  });

  it("derives the environment override from the name", () => {
    expect(getSwitchEnvName("auth.registration_closed")).toBe("SOFTURE_SWITCH_AUTH_REGISTRATION_CLOSED");
    expect(getSwitchEnvName("my-app.beta")).toBe("SOFTURE_SWITCH_MY_APP_BETA");
  });

  it("needs the auth module, so the panel is never mounted without a role check", () => {
    expect(() =>
      defineSoftureConfig({ database: { url: "pglite://" }, locale: "en", timezone: "UTC", appOrigin: "http://localhost:3000", modules: [featureSwitches()] }),
    ).toThrow('module "feature-switches" needs module "auth" (^0.1.0), which is not listed');
    expect(auth.id).toBe("auth");
  });

  it("lists auth before feature-switches when sorting, so its migrations run first", () => {
    expect(createConfig().modules.map((module) => module.id)).toEqual(["security", "auth", "feature-switches"]);
  });
});

describe("the switches table", () => {
  let test: TestSwitches;

  beforeEach(async () => {
    test = await createTestSwitches();
  });
  afterEach(async () => {
    await test.database.close();
  });

  const insert = (name: string, updatedBy: string | null = null) =>
    test.database.client.query("INSERT INTO features.switches (name, enabled, updated_at, updated_by) VALUES ($1, true, $2, $3)", [
      name,
      NOW,
      updatedBy,
    ]);

  it("accepts a well-formed name", async () => {
    await expect(insert("my-app.beta_2")).resolves.toBeDefined();
  });

  it.each([
    ["a name without a scope", "beta", null],
    ["an uppercase name", "App.beta", null],
    ["a name over 100 characters", `app.${"x".repeat(97)}`, null],
    ["an empty updated_by", "app.beta", ""],
  ])("rejects %s", async (_case, name, updatedBy) => {
    await expect(insert(name, updatedBy)).rejects.toThrow(/check constraint/);
  });

  it("keeps one row per switch", async () => {
    await insert("app.beta");
    await expect(insert("app.beta")).rejects.toThrow(/duplicate key/);
  });
});

describe("the feature-switches health check", () => {
  it("passes once the table exists and throws without it", async () => {
    const test = await createTestSwitches();
    try {
      expect(await featureSwitches().health?.(test.ctx)).toEqual({ ok: true, value: undefined });
      await test.database.client.query("DROP TABLE features.switches");
      await expect(featureSwitches().health?.(test.ctx)).rejects.toThrow(/features\.switches/);
    } finally {
      await test.database.close();
    }
  });
});
