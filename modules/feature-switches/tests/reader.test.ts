// The module as the app's switch provider: other modules read the switches the app defines here
// through `readSwitch` of core, auth's registration switch among them, and the panel reports the
// manifest switches the app left undefined.
import { REGISTRATION_CLOSED_ENV, REGISTRATION_CLOSED_SWITCH } from "@softure-ai/auth";
import { isRegistrationClosed, registerUser } from "@softure-ai/auth/server";
import { readSwitch } from "@softure-ai/core";
import { listUndefinedManifestSwitches, setSwitch, type SwitchContext } from "@softure-ai/feature-switches/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createConfig, createTestSwitches, SWITCHES, type TestSwitches } from "./support.js";

const REGISTRATION_SWITCH = { name: REGISTRATION_CLOSED_SWITCH, default: false, failMode: "open" } as const;
const REGISTER_INPUT = { email: "new@example.com", password: "correct horse battery", hasConsented: true, clientKey: "ip:198.51.100.7" };

describe("the switch reader", () => {
  let test: TestSwitches | undefined;

  afterEach(async () => {
    await test?.database.close();
    test = undefined;
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  /** A context whose every query fails, as with the database down. */
  function brokenContext(ctx: SwitchContext): SwitchContext {
    const failing = () => {
      throw new Error("connect ECONNREFUSED 127.0.0.1:5432");
    };
    return { ...ctx, db: { select: failing } as unknown as SwitchContext["db"] };
  }

  it("answers the value of a defined switch: default, then stored", async () => {
    test = await createTestSwitches();
    expect(await readSwitch(test.ctx, "app.beta_banner")).toEqual({ kind: "value", isEnabled: true });
    await setSwitch(test.ctx, { name: "app.beta_banner", isEnabled: false, actorId: null });
    expect(await readSwitch(test.ctx, "app.beta_banner")).toEqual({ kind: "value", isEnabled: false });
  });

  it("lets the environment override win over the stored value", async () => {
    test = await createTestSwitches();
    await setSwitch(test.ctx, { name: "billing.checkout_enabled", isEnabled: false, actorId: null });
    vi.stubEnv("SOFTURE_SWITCH_BILLING_CHECKOUT_ENABLED", "on");
    expect(await readSwitch(test.ctx, "billing.checkout_enabled")).toEqual({ kind: "value", isEnabled: true });
  });

  it("answers undeclared for a name the app did not define, instead of throwing", async () => {
    test = await createTestSwitches();
    expect(await readSwitch(test.ctx, REGISTRATION_CLOSED_SWITCH)).toEqual({ kind: "undeclared" });
  });

  it("answers the fail mode when the stored state cannot be read", async () => {
    test = await createTestSwitches();
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    expect(await readSwitch(brokenContext(test.ctx), "app.beta_banner")).toEqual({ kind: "value", isEnabled: true });
    expect(await readSwitch(brokenContext(test.ctx), "billing.checkout_enabled")).toEqual({ kind: "value", isEnabled: false });
  });

  describe("auth.registration_closed defined here", () => {
    it("closes registration when an admin stores it on, and opens it again when stored off", async () => {
      test = await createTestSwitches(createConfig([...SWITCHES, REGISTRATION_SWITCH]));
      expect(await isRegistrationClosed(test.ctx)).toBe(false);

      await setSwitch(test.ctx, { name: REGISTRATION_CLOSED_SWITCH, isEnabled: true, actorId: null });
      expect(await isRegistrationClosed(test.ctx)).toBe(true);
      expect(await registerUser(test.ctx, REGISTER_INPUT)).toEqual({ ok: false, error: "auth.registration_closed" });

      await setSwitch(test.ctx, { name: REGISTRATION_CLOSED_SWITCH, isEnabled: false, actorId: null });
      expect(await isRegistrationClosed(test.ctx)).toBe(false);
      expect((await registerUser(test.ctx, REGISTER_INPUT)).ok).toBe(true);
    });

    it("wins over auth's own registrationClosed option, which only applies while the switch is undefined", async () => {
      test = await createTestSwitches(createConfig([REGISTRATION_SWITCH], "en", { registrationClosed: true }));
      expect(await isRegistrationClosed(test.ctx)).toBe(false);
      expect(await isRegistrationClosed({ ...test.ctx, config: createConfig([], "en", { registrationClosed: true }) })).toBe(true);
    });

    it("keeps registration closed when the stored state cannot be read, with fail mode open", async () => {
      test = await createTestSwitches(createConfig([REGISTRATION_SWITCH]));
      vi.spyOn(console, "error").mockImplementation(() => undefined);
      expect(await isRegistrationClosed(brokenContext(test.ctx))).toBe(true);
    });

    it("follows the shared env override, which feature-switches reads", async () => {
      test = await createTestSwitches(createConfig([REGISTRATION_SWITCH]));
      await setSwitch(test.ctx, { name: REGISTRATION_CLOSED_SWITCH, isEnabled: false, actorId: null });
      vi.stubEnv(REGISTRATION_CLOSED_ENV, "on");
      expect(await isRegistrationClosed(test.ctx)).toBe(true);
    });
  });

  describe("listUndefinedManifestSwitches", () => {
    it("lists auth's registration switch while the app does not define it", () => {
      expect(listUndefinedManifestSwitches(createConfig())).toEqual([{ name: REGISTRATION_CLOSED_SWITCH, moduleId: "auth" }]);
    });

    it("is empty once the app defines it", () => {
      expect(listUndefinedManifestSwitches(createConfig([...SWITCHES, REGISTRATION_SWITCH]))).toEqual([]);
    });
  });
});
