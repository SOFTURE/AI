// The feature-switches contributor to GDPR exports and deletions: a switch names whoever set it
// last; deleting that user clears the name and keeps the switch.
import { featureSwitches } from "@softure-ai/feature-switches";
import { deleteSwitchesUserData, exportSwitchesUserData, setSwitch } from "@softure-ai/feature-switches/server";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createTestSwitches, listRows, NOW, type TestSwitches } from "./support.js";

const ADA = "7d1f3c1e-2b3a-4c5d-8e9f-0a1b2c3d4e5f";
const BOB = "0b9e2f4a-6c1d-4e3b-9a8f-7c6d5e4f3a2b";

describe("the feature-switches privacy contributor", () => {
  let test: TestSwitches;

  beforeEach(async () => {
    test = await createTestSwitches();
    await setSwitch(test.ctx, { name: "billing.checkout_enabled", isEnabled: true, actorId: ADA });
    await setSwitch(test.ctx, { name: "app.beta_banner", isEnabled: false, actorId: BOB });
  });
  afterEach(async () => {
    await test.database.close();
  });

  it("is registered with the module, as its manifest promises", () => {
    expect(featureSwitches.manifest.privacy).toEqual({ exports: true, deletes: true });
    expect(featureSwitches().privacy?.exportUserData).toBe(exportSwitchesUserData);
  });

  it("exports the switches the user set last", async () => {
    expect(await exportSwitchesUserData(test.ctx, ADA)).toEqual({
      ok: true,
      value: { lastSetSwitches: [{ name: "billing.checkout_enabled", isEnabled: true, updatedAt: NOW }] },
    });
    expect(await exportSwitchesUserData(test.ctx, "someone-else")).toEqual({ ok: true, value: { lastSetSwitches: [] } });
  });

  it("clears the user from the switches they set and keeps every switch's state", async () => {
    expect(await deleteSwitchesUserData(test.ctx, ADA)).toEqual({ ok: true, value: undefined });
    expect(await listRows(test.database)).toEqual([`app.beta_banner false ${BOB}`, "billing.checkout_enabled true null"]);
  });
});
