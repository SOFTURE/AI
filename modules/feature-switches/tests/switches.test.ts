// The value of a switch: environment override, then the stored row, then the declared default,
// and the fail mode when the stored state or the override cannot be read.
import type { SwitchContext } from "@softure-ai/feature-switches/server";
import { isEnabled, listSwitches, readStoredSwitches, setSwitch } from "@softure-ai/feature-switches/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createConfig, createTestSwitches, listRows, NOW, type TestSwitches } from "./support.js";

const NO_ENV = {};
const ADMIN_ID = "7d1f3c1e-2b3a-4c5d-8e9f-0a1b2c3d4e5f";

describe("feature switches", () => {
  let test: TestSwitches;

  beforeEach(async () => {
    test = await createTestSwitches();
  });
  afterEach(async () => {
    await test.database.close();
    vi.restoreAllMocks();
  });

  /** A context whose every query fails, as with the database down. */
  function brokenContext(): SwitchContext {
    const failing = () => {
      throw new Error("connect ECONNREFUSED 127.0.0.1:5432");
    };
    return { ...test.ctx, db: { select: failing } as unknown as SwitchContext["db"] };
  }

  describe("isEnabled", () => {
    it("reads the declared default while nothing is stored", async () => {
      expect(await isEnabled(test.ctx, "billing.checkout_enabled", NO_ENV)).toBe(false);
      expect(await isEnabled(test.ctx, "app.beta_banner", NO_ENV)).toBe(true);
    });

    it("reads the stored value over the default", async () => {
      await setSwitch(test.ctx, { name: "billing.checkout_enabled", isEnabled: true, actorId: ADMIN_ID });
      await setSwitch(test.ctx, { name: "app.beta_banner", isEnabled: false, actorId: ADMIN_ID });
      expect(await isEnabled(test.ctx, "billing.checkout_enabled", NO_ENV)).toBe(true);
      expect(await isEnabled(test.ctx, "app.beta_banner", NO_ENV)).toBe(false);
    });

    it.each([
      ["true", true],
      ["1", true],
      [" ON ", true],
      ["false", false],
      ["0", false],
      ["off", false],
    ])("lets the environment override %j win over the stored value", async (value, expected) => {
      await setSwitch(test.ctx, { name: "billing.checkout_enabled", isEnabled: !expected, actorId: ADMIN_ID });
      expect(await isEnabled(test.ctx, "billing.checkout_enabled", { SOFTURE_SWITCH_BILLING_CHECKOUT_ENABLED: value })).toBe(expected);
    });

    it("ignores an empty override", async () => {
      expect(await isEnabled(test.ctx, "app.beta_banner", { SOFTURE_SWITCH_APP_BETA_BANNER: " " })).toBe(true);
    });

    it("takes the fail mode for an override that is not a boolean, and logs the variable name but not its value", async () => {
      const log = vi.spyOn(console, "error").mockImplementation(() => undefined);
      await setSwitch(test.ctx, { name: "billing.checkout_enabled", isEnabled: true, actorId: ADMIN_ID });
      const env = { SOFTURE_SWITCH_BILLING_CHECKOUT_ENABLED: "secret-yes", SOFTURE_SWITCH_APP_BETA_BANNER: "maybe" };
      expect(await isEnabled(test.ctx, "billing.checkout_enabled", env)).toBe(false);
      expect(await isEnabled(test.ctx, "app.beta_banner", env)).toBe(true);
      const logged = log.mock.calls.map((call) => String(call[0])).join("\n");
      expect(logged).toContain("SOFTURE_SWITCH_BILLING_CHECKOUT_ENABLED");
      expect(logged).not.toContain("secret-yes");
    });

    it("takes the fail mode when the database cannot be read: closed reads as off, open as on", async () => {
      const log = vi.spyOn(console, "error").mockImplementation(() => undefined);
      const broken = brokenContext();
      expect(await isEnabled(broken, "billing.checkout_enabled", NO_ENV)).toBe(false);
      expect(await isEnabled(broken, "app.beta_banner", NO_ENV)).toBe(true);
      expect(log).toHaveBeenCalledWith("@softure-ai/feature-switches: reading switches failed: Error");
    });

    it("still honours the environment override while the database is down", async () => {
      vi.spyOn(console, "error").mockImplementation(() => undefined);
      expect(await isEnabled(brokenContext(), "billing.checkout_enabled", { SOFTURE_SWITCH_BILLING_CHECKOUT_ENABLED: "1" })).toBe(true);
    });

    it("throws for a switch the app did not declare", async () => {
      await expect(isEnabled(test.ctx, "billing.chekout_enabled", NO_ENV)).rejects.toThrow(
        '@softure-ai/feature-switches: switch "billing.chekout_enabled" is not declared',
      );
    });

    it("ignores a stored row of a switch that is no longer declared", async () => {
      await test.database.client.query("INSERT INTO features.switches (name, enabled, updated_at) VALUES ('old.switch', true, $1)", [NOW]);
      expect((await listSwitches(test.ctx, NO_ENV)).map((view) => view.name)).toEqual(["billing.checkout_enabled", "app.beta_banner"]);
    });
  });

  describe("an override that only works towards the fail mode", () => {
    const ONE_WAY = [
      { name: "auth.registration_closed", default: false, failMode: "open" as const, override: "towards-fail-mode" as const },
      { name: "billing.checkout_enabled", default: true, failMode: "closed" as const, override: "towards-fail-mode" as const },
      { name: "app.uploads_enabled", default: true, failMode: "closed" as const, override: "towards-fail-mode" as const },
    ];
    let oneWay: TestSwitches;

    beforeEach(async () => {
      oneWay = await createTestSwitches(createConfig(ONE_WAY));
    });
    afterEach(async () => {
      await oneWay.database.close();
    });

    it("applies the value that matches the fail mode over a stored one", async () => {
      await setSwitch(oneWay.ctx, { name: "auth.registration_closed", isEnabled: false, actorId: ADMIN_ID });
      await setSwitch(oneWay.ctx, { name: "billing.checkout_enabled", isEnabled: true, actorId: ADMIN_ID });
      const env = { SOFTURE_SWITCH_AUTH_REGISTRATION_CLOSED: "true", SOFTURE_SWITCH_BILLING_CHECKOUT_ENABLED: "off" };
      expect(await isEnabled(oneWay.ctx, "auth.registration_closed", env)).toBe(true);
      expect(await isEnabled(oneWay.ctx, "billing.checkout_enabled", env)).toBe(false);
      expect((await listSwitches(oneWay.ctx, env)).map((view) => view.source)).toEqual(["env", "env", "default"]);
    });

    it("ignores the opposite value: the stored one stays, and the variable is logged once by name", async () => {
      const log = vi.spyOn(console, "error").mockImplementation(() => undefined);
      await setSwitch(oneWay.ctx, { name: "auth.registration_closed", isEnabled: true, actorId: ADMIN_ID });
      await setSwitch(oneWay.ctx, { name: "billing.checkout_enabled", isEnabled: false, actorId: ADMIN_ID });
      const env = { SOFTURE_SWITCH_AUTH_REGISTRATION_CLOSED: "false", SOFTURE_SWITCH_BILLING_CHECKOUT_ENABLED: "1" };
      expect(await isEnabled(oneWay.ctx, "auth.registration_closed", env)).toBe(true);
      expect(await isEnabled(oneWay.ctx, "auth.registration_closed", env)).toBe(true);
      expect(await isEnabled(oneWay.ctx, "billing.checkout_enabled", env)).toBe(false);
      expect((await listSwitches(oneWay.ctx, env)).map((view) => view.source)).toEqual(["stored", "stored", "default"]);
      expect(log.mock.calls.map((call) => String(call[0]))).toEqual([
        "@softure-ai/feature-switches: SOFTURE_SWITCH_AUTH_REGISTRATION_CLOSED only moves the switch towards its fail mode (on); the value is ignored",
        "@softure-ai/feature-switches: SOFTURE_SWITCH_BILLING_CHECKOUT_ENABLED only moves the switch towards its fail mode (off); the value is ignored",
      ]);
    });

    it("ignores the opposite value over the declared default too", async () => {
      vi.spyOn(console, "error").mockImplementation(() => undefined);
      expect(await isEnabled(oneWay.ctx, "app.uploads_enabled", { SOFTURE_SWITCH_APP_UPLOADS_ENABLED: "true" })).toBe(true);
      expect((await listSwitches(oneWay.ctx, { SOFTURE_SWITCH_APP_UPLOADS_ENABLED: "true" }))[2]?.source).toBe("default");
    });

    it("keeps both directions by default", async () => {
      await setSwitch(test.ctx, { name: "app.beta_banner", isEnabled: true, actorId: ADMIN_ID });
      expect(await isEnabled(test.ctx, "app.beta_banner", { SOFTURE_SWITCH_APP_BETA_BANNER: "false" })).toBe(false);
    });
  });

  describe("setSwitch", () => {
    it("stores the value with when and by whom, and updates it in place", async () => {
      expect(await setSwitch(test.ctx, { name: "billing.checkout_enabled", isEnabled: true, actorId: ADMIN_ID })).toEqual({ ok: true, value: undefined });
      test.clock.advance(60_000);
      expect(await setSwitch(test.ctx, { name: "billing.checkout_enabled", isEnabled: false, actorId: null })).toEqual({ ok: true, value: undefined });
      expect(await listRows(test.database)).toEqual(["billing.checkout_enabled false null"]);
      const stored = await readStoredSwitches(test.ctx);
      expect(stored.ok && stored.value.get("billing.checkout_enabled")?.updatedAt).toEqual(new Date(NOW.getTime() + 60_000));
    });

    it("refuses a switch the app did not declare and stores nothing", async () => {
      expect(await setSwitch(test.ctx, { name: "billing.unknown", isEnabled: true, actorId: ADMIN_ID })).toEqual({
        ok: false,
        error: "feature-switches.unknown_switch",
      });
      expect(await listRows(test.database)).toEqual([]);
    });
  });

  describe("listSwitches", () => {
    it("lists every declared switch with its value, source, override name and last change", async () => {
      await setSwitch(test.ctx, { name: "app.beta_banner", isEnabled: false, actorId: ADMIN_ID });
      expect(await listSwitches(test.ctx, { SOFTURE_SWITCH_BILLING_CHECKOUT_ENABLED: "true" })).toEqual([
        {
          name: "billing.checkout_enabled",
          label: "Checkout",
          description: "Lets users pay.",
          isEnabled: true,
          source: "env",
          envName: "SOFTURE_SWITCH_BILLING_CHECKOUT_ENABLED",
          updatedAt: null,
          updatedBy: null,
        },
        {
          name: "app.beta_banner",
          label: "app.beta_banner",
          description: null,
          isEnabled: false,
          source: "stored",
          envName: "SOFTURE_SWITCH_APP_BETA_BANNER",
          updatedAt: NOW,
          updatedBy: ADMIN_ID,
        },
      ]);
    });

    it("shows the copy of the app's locale, falling back to English", async () => {
      const polish = await createTestSwitches(createConfig(undefined, "pl"));
      try {
        const views = await listSwitches(polish.ctx, NO_ENV);
        expect(views.map((view) => [view.label, view.description, view.source])).toEqual([
          ["Kasa", "Lets users pay.", "default"],
          ["app.beta_banner", null, "default"],
        ]);
      } finally {
        await polish.database.close();
      }
    });

    it("shows every switch at its fail mode while the database is down", async () => {
      vi.spyOn(console, "error").mockImplementation(() => undefined);
      expect((await listSwitches(brokenContext(), NO_ENV)).map((view) => [view.name, view.isEnabled, view.source])).toEqual([
        ["billing.checkout_enabled", false, "fail-mode"],
        ["app.beta_banner", true, "fail-mode"],
      ]);
    });

    it("is empty when the app declares no switches", async () => {
      const empty = await createTestSwitches(createConfig([]));
      try {
        expect(await listSwitches(empty.ctx, NO_ENV)).toEqual([]);
      } finally {
        await empty.database.close();
      }
    });
  });
});
