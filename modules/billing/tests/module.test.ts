// The module definition: its manifest, its options, its dependencies and its health check.
import { readFileSync } from "node:fs";
import { billing } from "@softure-ai/billing";
import { checkEntitlementsTable, getBillingRoutes } from "@softure-ai/billing/server";
import { defineSoftureConfig, toModuleJson } from "@softure-ai/core";
import { describe, expect, it } from "vitest";
import { createConfig, createTestBilling } from "./support.js";

describe("the billing module", () => {
  it("ships a module.json equal to its manifest", () => {
    const moduleJson: unknown = JSON.parse(readFileSync(new URL("../module.json", import.meta.url), "utf8"));
    expect(moduleJson).toEqual(toModuleJson(billing));
  });

  it("keeps the package version and the manifest version in step", () => {
    const manifest = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8")) as { version: string };
    expect(billing.manifest.version).toBe(manifest.version);
  });

  it("fills in the defaults: a 14-day trial, reminders 3 and 7 days ahead, payment at /payment", () => {
    expect(billing({}).options).toEqual({ trial: { days: 14, reminderDays: 3 }, paid: { reminderDays: 7 } });
    expect(getBillingRoutes(createConfig())).toEqual({ payment: "/payment" });
    expect(getBillingRoutes(createConfig({ routes: { payment: "/pricing" } }))).toEqual({ payment: "/pricing" });
  });

  it("refuses day counts it cannot use, listing every problem", () => {
    expect(() => billing({ trial: { days: -1, reminderDays: 1.5 }, paid: { reminderDays: 400 } })).toThrow(
      [
        'Invalid SOFTURE configuration in module "billing":',
        "- options.trial.days: Too small: expected number to be >=0",
        "- options.trial.reminderDays: Invalid input: expected int, received number",
        "- options.paid.reminderDays: Too big: expected number to be <=365",
      ].join("\n"),
    );
  });

  it("needs auth in the config", () => {
    expect(() =>
      defineSoftureConfig({
        database: { url: "pglite://" },
        locale: "en",
        timezone: "UTC",
        appOrigin: "https://app.example.com",
        modules: [billing({})],
      }),
    ).toThrow('module "billing" needs module "auth" (^0.0.0), which is not listed');
  });

  it("reports healthy once its table exists", async () => {
    const test = await createTestBilling();
    try {
      expect(await checkEntitlementsTable(test.ctx)).toEqual({ ok: true, value: undefined });
      await test.database.client.exec("DROP TABLE billing.entitlements");
      await expect(checkEntitlementsTable(test.ctx)).rejects.toThrow();
    } finally {
      await test.database.close();
    }
  });
});
