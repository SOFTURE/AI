// Granting plans and starting payments on PGlite: a grant computed under the entitlement's lock,
// the payment bucket counted first, the plan and the invoice details checked, and the manual
// adapter handing the request over.
import { BILLING_RATE_LIMIT_BUCKETS, manual, type BillingOptionsInput, type PaymentProvider, type PaymentRequest } from "@softure-ai/billing";
import { changeEntitlement, findAccountByEmail, getEntitlement, grantPlan, startPayment } from "@softure-ai/billing/server";
import { err, ok } from "@softure-ai/core";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createAccount, createConfig, createTestBilling, type TestBilling } from "./support.js";

/** The end of a 14-day trial begun at NOW: midnight starting 17 October in Warsaw. */
const TRIAL_END = new Date("2026-10-16T22:00:00Z");
const UNKNOWN_ID = "00000000-0000-4000-8000-000000000000";

const PLANS: BillingOptionsInput["plans"] = [
  { id: "monthly", name: { en: "Monthly", pl: "Monthly (pl)" }, price: { amount: 2900, currency: "PLN" }, period: "month" },
  { id: "lifetime", name: { en: "Lifetime" }, price: { amount: 49900, currency: "PLN" }, period: "lifetime" },
];

const INVOICE = { name: "  Ada Lovelace Ltd  ", taxId: " PL1234567890 ", address: "1 Analytical Way, London" };

function createRecorder(answer: () => ReturnType<Parameters<typeof manual>[0]["onRequest"]> = () => Promise.resolve(ok())) {
  const requests: PaymentRequest[] = [];
  const provider = manual({
    onRequest: (request) => {
      requests.push(request);
      return answer();
    },
  });
  return { requests, provider };
}

describe("grantPlan", () => {
  let test: TestBilling;
  let adaId: string;

  beforeEach(async () => {
    test = await createTestBilling({ plans: PLANS });
    adaId = await createAccount(test, "ada@example.com");
  });
  afterEach(() => test.database.close());

  it("starts the paid month when the running trial ends", async () => {
    expect(await grantPlan(test.ctx, adaId, "monthly")).toEqual(
      ok({ status: "paid", endsAt: new Date("2026-11-16T23:00:00Z"), daysLeft: 45, isEnding: false }),
    );
  });

  it("adds a period for each grant, also when two run at once", async () => {
    await Promise.all([grantPlan(test.ctx, adaId, "monthly"), grantPlan(test.ctx, adaId, "monthly")]);
    expect(await getEntitlement(test.ctx, adaId)).toMatchObject({ status: "paid", endsAt: new Date("2026-12-16T23:00:00Z") });
  });

  it("starts now once the account's access has ended", async () => {
    test.clock.set(new Date("2026-10-20T08:00:00Z"));
    expect(await grantPlan(test.ctx, adaId, "monthly")).toMatchObject({ ok: true, value: { status: "paid", endsAt: new Date("2026-11-19T23:00:00Z") } });
  });

  it("grants lifetime access for a lifetime plan", async () => {
    expect(await grantPlan(test.ctx, adaId, "lifetime")).toEqual(ok({ status: "paid", endsAt: null, daysLeft: null, isEnding: false }));
  });

  it("refuses an unknown plan or account and writes nothing", async () => {
    expect(await grantPlan(test.ctx, adaId, "weekly")).toEqual(err("billing.plan_unknown"));
    expect(await grantPlan(test.ctx, UNKNOWN_ID, "monthly")).toEqual(err("billing.account_unknown"));
    expect(await getEntitlement(test.ctx, adaId)).toMatchObject({ status: "trial", endsAt: TRIAL_END });
  });

  it("lets changeEntitlement decide the event from the locked record", async () => {
    const result = await changeEntitlement(test.ctx, adaId, (record) => ({ type: "extend_trial", until: new Date(record.trialEndsAt.getTime() + 86_400_000) }));
    expect(result).toMatchObject({ ok: true, value: { status: "trial", endsAt: new Date("2026-10-17T22:00:00Z") } });
  });
});

describe("findAccountByEmail", () => {
  it("finds an account by its address in any case, and nothing for an unknown one", async () => {
    const test = await createTestBilling();
    try {
      const id = await createAccount(test, "ada@example.com");
      expect(await findAccountByEmail(test.ctx, "  ADA@Example.com ")).toEqual({ id, email: "ada@example.com" });
      expect(await findAccountByEmail(test.ctx, "bob@example.com")).toBeNull();
    } finally {
      await test.database.close();
    }
  });
});

describe("startPayment", () => {
  let test: TestBilling;
  let recorder: ReturnType<typeof createRecorder>;
  let account: { id: string; email: string };

  beforeEach(async () => {
    recorder = createRecorder();
    test = await createTestBilling({ plans: PLANS, payment: recorder.provider });
    account = { id: await createAccount(test, "ada@example.com"), email: "ada@example.com" };
  });
  afterEach(() => test.database.close());

  it("hands a manual request over with the plan, the account, trimmed details and the return address", async () => {
    expect(await startPayment(test.ctx, { account, planId: "monthly", invoice: INVOICE })).toEqual(ok({ type: "requested" }));
    expect(recorder.requests).toEqual([
      {
        plan: expect.objectContaining({ id: "monthly", price: { amount: 2900, currency: "PLN" } }) as unknown,
        account,
        invoice: { name: "Ada Lovelace Ltd", taxId: "PL1234567890", address: "1 Analytical Way, London" },
        returnUrl: "https://app.example.com/payment",
      },
    ]);
    // A request grants nothing: the admin does once the invoice is paid.
    expect(await getEntitlement(test.ctx, account.id)).toMatchObject({ status: "trial" });
  });

  it("sends an empty tax id as null", async () => {
    await startPayment(test.ctx, { account, planId: "monthly", invoice: { ...INVOICE, taxId: "  " } });
    expect(recorder.requests[0]?.invoice?.taxId).toBeNull();
  });

  it("names every invoice field that is missing or too long, and hands nothing over", async () => {
    expect(await startPayment(test.ctx, { account, planId: "monthly", invoice: { name: " ", taxId: "x".repeat(33), address: "a".repeat(501) } })).toEqual({
      ...err("billing.invoice_details_invalid"),
      fieldErrors: {
        invoiceName: "billing.invoice_details_invalid",
        invoiceTaxId: "billing.invoice_details_invalid",
        invoiceAddress: "billing.invoice_details_invalid",
      },
    });
    expect(recorder.requests).toEqual([]);
  });

  it("refuses a plan the config does not declare", async () => {
    expect(await startPayment(test.ctx, { account, planId: "weekly", invoice: INVOICE })).toEqual(err("billing.plan_unknown"));
    expect(recorder.requests).toEqual([]);
  });

  it("counts every attempt per account and refuses the one over the limit", async () => {
    const { limit } = BILLING_RATE_LIMIT_BUCKETS["billing-payment"];
    for (let attempt = 0; attempt < limit; attempt += 1) {
      expect((await startPayment(test.ctx, { account, planId: attempt === 0 ? "weekly" : "monthly", invoice: INVOICE })).ok, String(attempt)).toBe(attempt !== 0);
    }
    expect(await startPayment(test.ctx, { account, planId: "monthly", invoice: INVOICE })).toEqual(err("security.rate_limited"));
    expect(recorder.requests).toHaveLength(limit - 1);
    // Another account has its own count.
    const bob = { id: await createAccount(test, "bob@example.com"), email: "bob@example.com" };
    expect(await startPayment(test.ctx, { account: bob, planId: "monthly", invoice: INVOICE })).toEqual(ok({ type: "requested" }));
  });

  it("answers payment_failed when the request could not be handed over, and logs the code", async () => {
    const failing = createRecorder(() => Promise.resolve(err("mailing.unavailable")));
    const other = await createTestBilling({ plans: PLANS, payment: failing.provider });
    const log = vi.spyOn(console, "error").mockImplementation(() => undefined);
    try {
      const id = await createAccount(other, "ada@example.com");
      expect(await startPayment(other.ctx, { account: { id, email: "ada@example.com" }, planId: "monthly", invoice: INVOICE })).toEqual(err("billing.payment_failed"));
      expect(log).toHaveBeenCalledWith('@softure-ai/billing: the manual payment request for plan "monthly" was not handed over: mailing.unavailable');
    } finally {
      log.mockRestore();
      await other.database.close();
    }
  });

  it("skips the invoice details for a provider that collects its own, and passes its redirect on", async () => {
    const seen: PaymentRequest[] = [];
    const hosted: PaymentProvider = {
      name: "hosted",
      collectsInvoiceDetails: false,
      startPayment: (_ctx, request) => {
        seen.push(request);
        return Promise.resolve(ok({ type: "redirect", url: "https://pay.example.com/session/1" }));
      },
    };
    const other = await createTestBilling({ plans: PLANS, payment: hosted });
    try {
      const id = await createAccount(other, "ada@example.com");
      const result = await startPayment(other.ctx, { account: { id, email: "ada@example.com" }, planId: "lifetime", invoice: { name: "", taxId: "", address: "" } });
      expect(result).toEqual(ok({ type: "redirect", url: "https://pay.example.com/session/1" }));
      expect(seen[0]?.invoice).toBeNull();
    } finally {
      await other.database.close();
    }
  });

  it("fails loudly without a provider or without the payment bucket", async () => {
    const noProvider = await createTestBilling({ plans: PLANS });
    try {
      await expect(startPayment(noProvider.ctx, { account, planId: "monthly", invoice: INVOICE })).rejects.toThrow(
        "@softure-ai/billing: billing({ payment }) is not set; the payment page needs a provider such as manual()",
      );
    } finally {
      await noProvider.database.close();
    }
    const config = createConfig({ plans: PLANS, payment: recorder.provider });
    // The same app with security's buckets emptied, as if BILLING_RATE_LIMIT_BUCKETS was not spread in.
    const withoutBucket = {
      ...config,
      modules: config.modules.map((module) => (module.manifest.id === "security" ? { ...module, options: { ...(module.options as object), buckets: {} } } : module)),
    };
    await expect(startPayment({ ...test.ctx, config: withoutBucket }, { account, planId: "monthly", invoice: INVOICE })).rejects.toThrow(
      '@softure-ai/billing: security({ buckets }) lacks "billing-payment"; spread BILLING_RATE_LIMIT_BUCKETS into it',
    );
  });
});
