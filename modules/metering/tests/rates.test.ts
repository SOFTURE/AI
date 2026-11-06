// The provider rate read from the ledger's settled reported charges.
import { createFootageChargeRecorder, getChargeRate, recordCharge, reserveSpend } from "@softure-ai/metering/server";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createTestMetering, type TestMetering } from "./support.js";

describe("getChargeRate", () => {
  let test: TestMetering;

  beforeEach(async () => {
    test = await createTestMetering();
  });
  afterEach(async () => {
    await test.database.close();
  });

  async function recordIsolations(accountId: string, charges: readonly { readonly units: number; readonly credits?: number }[]): Promise<void> {
    const recorder = createFootageChargeRecorder(test.ctx, { accountId, creditsPerSecond: 100 });
    for (const [index, charge] of charges.entries()) {
      // One clock step per charge, so "latest" has a defined order.
      test.clock.advance(1000);
      recorder.onCharge({ step: "isolate", item: `clip-${String(index)}`, provider: "elevenlabs", ...charge });
      await recorder.flush();
    }
  }

  it("answers the amount per unit of the settled reported charges, skipping fallback ones", async () => {
    await recordIsolations("a", [{ units: 10, credits: 300 }, { units: 30 }, { units: 20, credits: 700 }]);
    const rate = await getChargeRate(test.ctx, { provider: "elevenlabs", step: "isolate" });
    expect(rate).toEqual({
      ok: true,
      value: { provider: "elevenlabs", unit: "credits", step: "isolate", accountId: null, rate: 1000 / 30, amount: 1000, units: 30, charges: 2 },
    });
  });

  it("reads only the latest charges, of one account when asked", async () => {
    await recordIsolations("a", [{ units: 10, credits: 100 }, { units: 10, credits: 200 }, { units: 10, credits: 400 }]);
    await recordIsolations("b", [{ units: 10, credits: 900 }]);
    expect((await getChargeRate(test.ctx, { provider: "elevenlabs", step: "isolate", accountId: "a", latest: 2 })).value).toEqual({
      provider: "elevenlabs",
      unit: "credits",
      step: "isolate",
      accountId: "a",
      rate: 30,
      amount: 600,
      units: 20,
      charges: 2,
    });
    expect((await getChargeRate(test.ctx, { provider: "elevenlabs", step: "isolate", latest: 1 })).value?.rate).toBe(90);
  });

  it("returns null without charges, below minUnits, and for other steps, reservations and charges without units", async () => {
    expect(await getChargeRate(test.ctx, { provider: "elevenlabs", step: "isolate" })).toEqual({ ok: true, value: null });
    await recordIsolations("a", [{ units: 10, credits: 300 }]);
    await reserveSpend(test.ctx, { provider: "elevenlabs", amount: 5, step: "isolate", accountId: "a", attributes: { units: "1", reported: "true" } });
    await recordCharge(test.ctx, { provider: "elevenlabs", amount: 50, step: "isolate", accountId: "a", attributes: { units: "many", reported: "true" } });
    await recordCharge(test.ctx, { provider: "elevenlabs", amount: 50, step: "music", accountId: "a", attributes: { units: "1", reported: "true" } });
    expect((await getChargeRate(test.ctx, { provider: "elevenlabs", step: "isolate" })).value?.rate).toBe(30);
    expect(await getChargeRate(test.ctx, { provider: "elevenlabs", step: "isolate", minUnits: 11 })).toEqual({ ok: true, value: null });
    expect((await getChargeRate(test.ctx, { provider: "elevenlabs", step: "isolate", minUnits: 10 })).value?.units).toBe(10);
  });

  it("returns null when the charges billed zero units", async () => {
    await recordIsolations("a", [{ units: 0, credits: 0 }]);
    expect(await getChargeRate(test.ctx, { provider: "elevenlabs", step: "isolate" })).toEqual({ ok: true, value: null });
  });

  it("throws for an undeclared provider and invalid input", async () => {
    await expect(getChargeRate(test.ctx, { provider: "nope", step: "isolate" })).rejects.toThrow();
    await expect(getChargeRate(test.ctx, { provider: "elevenlabs", step: "" })).rejects.toThrow("getChargeRate: step must be 1 to 100 characters");
    await expect(getChargeRate(test.ctx, { provider: "elevenlabs", step: "isolate", latest: 0 })).rejects.toThrow(
      "getChargeRate: latest must be an integer from 1 to 1000, got 0",
    );
    await expect(getChargeRate(test.ctx, { provider: "elevenlabs", step: "isolate", minUnits: -1 })).rejects.toThrow(
      "getChargeRate: minUnits must be a finite number of at least 0, got -1",
    );
    await expect(getChargeRate(test.ctx, { provider: "elevenlabs", step: "isolate", accountId: "" })).rejects.toThrow();
  });
});
