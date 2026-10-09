// The module definition: its manifest, its options, its dependencies and its health check.
import { readFileSync } from "node:fs";
import { billing, BILLING_RATE_LIMIT_BUCKETS, manual, stripe, type BillingOptionsInput } from "@softure-ai/billing";
import { checkBillingTables, getBillingRoutes } from "@softure-ai/billing/server";
import { defineSoftureConfig, ok, toModuleJson } from "@softure-ai/core";
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

  it("fills in the defaults: a 14-day trial, reminders 3 and 7 days ahead, pro rata partial refunds, payment at /payment, the admin page at /admin/billing", () => {
    expect(billing({}).options).toEqual({ trial: { days: 14, reminderDays: 3 }, paid: { reminderDays: 7 }, requests: { expireAfterDays: 30 }, plans: [], partialRefunds: "pro_rata", adminRole: "admin" });
    expect(getBillingRoutes(createConfig())).toEqual({ payment: "/payment", admin: "/admin/billing" });
    expect(getBillingRoutes(createConfig({ routes: { payment: "/pricing", admin: "/staff/billing" } }))).toEqual({ payment: "/pricing", admin: "/staff/billing" });
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

  it("takes trial.startsAt as a calendar day and refuses anything else", () => {
    expect(billing({ trial: { startsAt: "2026-11-01" } }).options.trial).toEqual({ days: 14, reminderDays: 3, startsAt: "2026-11-01" });
    for (const startsAt of ["2026-02-30", "2026-1-1", "2026-11-01T00:00:00Z", ""]) {
      expect(() => billing({ trial: { startsAt } })).toThrow("- options.trial.startsAt: must be a calendar day as YYYY-MM-DD, e.g. 2026-11-01");
    }
  });

  it("normalizes plans: a period shorthand becomes a unit and a count, features and the flag get defaults", () => {
    const options = billing({
      plans: [
        { id: "monthly", name: { en: "Monthly" }, price: { amount: 2900, currency: "PLN" }, period: "month" },
        { id: "quarterly", name: { en: "Quarterly" }, price: { amount: 7900, currency: "PLN" }, period: { unit: "month", count: 3 }, isFeatured: true },
        { id: "lifetime", name: { en: "Lifetime", pl: "Lifetime (pl)" }, price: { amount: 49900, currency: "EUR" }, period: "lifetime", features: [{ en: "Everything" }] },
      ],
      payment: manual({ onRequest: () => Promise.resolve(ok()) }),
    }).options;
    expect(options.plans).toEqual([
      { id: "monthly", name: { en: "Monthly" }, price: { amount: 2900, currency: "PLN" }, period: { unit: "month", count: 1 }, features: [], isFeatured: false },
      { id: "quarterly", name: { en: "Quarterly" }, price: { amount: 7900, currency: "PLN" }, period: { unit: "month", count: 3 }, features: [], isFeatured: true },
      { id: "lifetime", name: { en: "Lifetime", pl: "Lifetime (pl)" }, price: { amount: 49900, currency: "EUR" }, period: { unit: "lifetime" }, features: [{ en: "Everything" }], isFeatured: false },
    ]);
    expect(options.payment?.name).toBe("manual");
  });

  it("refuses plans it cannot sell, listing every problem", () => {
    expect(() =>
      billing({
        plans: [
          { id: "Monthly", name: { pl: "Monthly (pl)" }, price: { amount: 29.5, currency: "pln" }, period: { unit: "month", count: 0 } },
          { id: "yearly", name: { en: "Yearly" }, price: { amount: -1, currency: "XYZ" }, period: "decade" as "year" },
        ],
      }),
    ).toThrow(
      [
        'Invalid SOFTURE configuration in module "billing":',
        "- options.plans.0.id: must be kebab-case, e.g. pro-yearly",
        "- options.plans.0.name: needs at least an en text",
        "- options.plans.0.price.amount: Invalid input: expected int, received number",
        "- options.plans.0.price.currency: must be an upper-case ISO 4217 currency code billing knows, e.g. PLN",
        "- options.plans.0.period.count: Too small: expected number to be >=1",
        "- options.plans.1.price.amount: Too small: expected number to be >=0",
        "- options.plans.1.price.currency: must be an upper-case ISO 4217 currency code billing knows, e.g. PLN",
        "- options.plans.1.period: Invalid input",
      ].join("\n"),
    );
  });

  it("refuses two plans with one id", () => {
    const yearly = { name: { en: "Yearly" }, price: { amount: 100, currency: "PLN" }, period: "year" } as const;
    expect(() => billing({ plans: [{ id: "yearly", ...yearly }, { id: "yearly", ...yearly }] })).toThrow('- options.plans.1.id: repeats the plan id "yearly"');
  });

  it("refuses a price the payment provider cannot charge, naming the plan; another provider takes it", () => {
    const plans: BillingOptionsInput["plans"] = [
      { id: "monthly", name: { en: "Monthly" }, price: { amount: 1500, currency: "ISK" }, period: "month" },
      { id: "yearly", name: { en: "Yearly" }, price: { amount: 12345, currency: "KWD" }, period: "year" },
    ];
    expect(() => billing({ plans, payment: stripe() })).toThrow(
      [
        'Invalid SOFTURE configuration in module "billing":',
        "- options.plans.1.price: stripe() charges KWD in multiples of 10 of its minor unit; round the amount to end in 0",
      ].join("\n"),
    );
    expect(billing({ plans, payment: manual({ onRequest: () => Promise.resolve(ok(undefined)) }) }).options.plans).toHaveLength(2);
  });

  it("refuses a payment provider whose price check is not a function", () => {
    const provider = { ...stripe(), checkPrice: "yes" };
    expect(() => billing({ payment: provider as never })).toThrow("- options.payment: must be a payment provider such as manual()");
  });

  it("takes an invoice request expiry from 1 to 365 days and refuses the rest", () => {
    expect(billing({ requests: { expireAfterDays: 1 } }).options).toMatchObject({ requests: { expireAfterDays: 1 } });
    expect(billing({ requests: { expireAfterDays: 365 } }).options).toMatchObject({ requests: { expireAfterDays: 365 } });
    for (const days of [0, 366, 1.5]) expect(() => billing({ requests: { expireAfterDays: days } }), String(days)).toThrow("- options.requests.expireAfterDays:");
  });

  it("takes keep_access as the partial refund policy and refuses any other", () => {
    expect(billing({ partialRefunds: "keep_access" }).options).toMatchObject({ partialRefunds: "keep_access" });
    expect(() => billing({ partialRefunds: "half" as never })).toThrow("- options.partialRefunds:");
  });

  it("refuses a payment adapter that is not one", () => {
    expect(() => billing({ payment: { name: "fake" } as never })).toThrow("- options.payment: must be a payment provider such as manual()");
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
    ).toThrow('module "billing" needs module "auth" (^0.1.0), which is not listed');
  });

  it("reports healthy once its table exists", async () => {
    const test = await createTestBilling();
    try {
      expect(await checkBillingTables(test.ctx)).toEqual({ ok: true, value: undefined });
      await test.database.client.exec("DROP TABLE billing.entitlements");
      await expect(checkBillingTables(test.ctx)).rejects.toThrow();
    } finally {
      await test.database.close();
    }
  });
});

describe("the rate limit bucket defaults (#328)", () => {
  it("declare what each bucket is keyed by", () => {
    const kinds = Object.fromEntries(Object.entries(BILLING_RATE_LIMIT_BUCKETS).map(([name, bucket]) => [name, bucket.key]));
    expect(kinds).toEqual({ "billing-payment": "account" });
  });
});
