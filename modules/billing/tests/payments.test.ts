// Granting plans and starting payments on PGlite: a grant computed under the entitlement's lock,
// the payment bucket counted first, the plan and the invoice details checked, and the manual
// adapter handing the request over.
import { BILLING_RATE_LIMIT_BUCKETS, manual, type BillingOptionsInput, type PaymentProvider, type PaymentRequest } from "@softure-ai/billing";
import { changeEntitlement, findAccountByEmail, getEntitlement, grantPlan, listOpenRequests, startPayment } from "@softure-ai/billing/server";
import { err, ok } from "@softure-ai/core";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createAccount, createConfig, createTestBilling, NOW, type TestBilling } from "./support.js";

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

  it("adds a period for each grant", async () => {
    // PGlite has one connection, so this runs the grants one after the other; the lock that makes
    // concurrent grants add up was checked against Postgres (reviews/impl-review.md).
    await grantPlan(test.ctx, adaId, "monthly");
    await grantPlan(test.ctx, adaId, "monthly");
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
    // A request grants nothing: the admin does once the invoice is paid. It is stored for the admin page.
    expect(await getEntitlement(test.ctx, account.id)).toMatchObject({ status: "trial" });
    expect(await listOpenRequests(test.ctx)).toEqual([
      {
        id: expect.any(String) as unknown,
        userId: account.id,
        email: "ada@example.com",
        planId: "monthly",
        invoice: { name: "Ada Lovelace Ltd", taxId: "PL1234567890", address: "1 Analytical Way, London" },
        price: { amount: 2900, currency: "PLN" },
        requestedAt: NOW,
      },
    ]);
  });

  it("stores the request before handing it over", async () => {
    const seen: unknown[] = [];
    const provider = manual({
      onRequest: async (_request, ctx) => {
        seen.push((await listOpenRequests({ db: ctx.db })).map((request) => request.planId));
        return ok();
      },
    });
    const other = await createTestBilling({ plans: PLANS, payment: provider });
    try {
      const id = await createAccount(other, "ada@example.com");
      expect(await startPayment(other.ctx, { account: { id, email: "ada@example.com" }, planId: "monthly", invoice: INVOICE })).toEqual(ok({ type: "requested" }));
      expect(seen).toEqual([["monthly"]]);
    } finally {
      await other.database.close();
    }
  });

  it("hands an open request over once: asking again refreshes it without a second hand-over", async () => {
    await startPayment(test.ctx, { account, planId: "monthly", invoice: INVOICE });
    const later = new Date("2026-10-04T08:00:00Z");
    test.clock.set(later);
    const corrected = { ...INVOICE, address: "2 Difference Lane, London" };
    expect(await startPayment(test.ctx, { account, planId: "monthly", invoice: corrected })).toEqual(ok({ type: "requested" }));
    expect(recorder.requests).toHaveLength(1);
    expect(await listOpenRequests(test.ctx)).toMatchObject([{ planId: "monthly", invoice: { address: "2 Difference Lane, London" }, requestedAt: later }]);
    // Another plan is another request, handed over on its own.
    await startPayment(test.ctx, { account, planId: "lifetime", invoice: INVOICE });
    expect(recorder.requests.map((request) => request.plan.id)).toEqual(["monthly", "lifetime"]);
  });

  it("hands over once when two asks run at once", async () => {
    let finish = (): void => undefined;
    const held = new Promise<void>((resolve) => {
      finish = resolve;
    });
    const slow = createRecorder(async () => {
      await held;
      return ok();
    });
    const other = await createTestBilling({ plans: PLANS, payment: slow.provider });
    try {
      const id = await createAccount(other, "ada@example.com");
      const ada = { id, email: "ada@example.com" };
      const first = startPayment(other.ctx, { account: ada, planId: "monthly", invoice: INVOICE });
      await vi.waitFor(() => {
        expect(slow.requests).toHaveLength(1);
      });
      // The first hand-over holds its claim: the second ask is stored and answered without one.
      expect(await startPayment(other.ctx, { account: ada, planId: "monthly", invoice: INVOICE })).toEqual(ok({ type: "requested" }));
      finish();
      expect(await first).toEqual(ok({ type: "requested" }));
      expect(slow.requests).toHaveLength(1);
      expect(await listOpenRequests(other.ctx)).toHaveLength(1);
    } finally {
      await other.database.close();
    }
  });

  it("refuses an account with lifetime access, handing nothing over and storing nothing", async () => {
    await grantPlan(test.ctx, account.id, "lifetime");
    expect(await startPayment(test.ctx, { account, planId: "monthly", invoice: INVOICE })).toEqual(err("billing.lifetime_active"));
    expect(recorder.requests).toEqual([]);
    expect(await listOpenRequests(test.ctx)).toEqual([]);
  });

  it("names every invoice field that is missing, too long or has control characters, and stores and hands nothing over", async () => {
    expect(await startPayment(test.ctx, { account, planId: "monthly", invoice: { name: " ", taxId: "x".repeat(33), address: "1 Way\nPlan: Lifetime" } })).toEqual({
      ...err("billing.invoice_details_invalid"),
      fieldErrors: {
        invoiceName: "billing.invoice_field_required",
        invoiceTaxId: "billing.invoice_field_too_long",
        invoiceAddress: "billing.invoice_field_control_characters",
      },
    });
    expect(recorder.requests).toEqual([]);
    expect(await listOpenRequests(test.ctx)).toEqual([]);
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
    // The first good ask handed the request over; the others only refreshed it.
    expect(recorder.requests).toHaveLength(1);
    // Another account has its own count.
    const bob = { id: await createAccount(test, "bob@example.com"), email: "bob@example.com" };
    expect(await startPayment(test.ctx, { account: bob, planId: "monthly", invoice: INVOICE })).toEqual(ok({ type: "requested" }));
  });

  it("answers payment_failed when the request could not be handed over, keeps it open and hands it over on the next ask", async () => {
    let answer: Awaited<ReturnType<Parameters<typeof manual>[0]["onRequest"]>> = err("mailing.unavailable");
    const failing = createRecorder(() => Promise.resolve(answer));
    const other = await createTestBilling({ plans: PLANS, payment: failing.provider });
    const log = vi.spyOn(console, "error").mockImplementation(() => undefined);
    try {
      const ada = { id: await createAccount(other, "ada@example.com"), email: "ada@example.com" };
      expect(await startPayment(other.ctx, { account: ada, planId: "monthly", invoice: INVOICE })).toEqual(err("billing.payment_failed"));
      expect(log).toHaveBeenCalledWith('@softure-ai/billing: the manual payment request for plan "monthly" was not handed over: mailing.unavailable');
      // Stored first, so the admin page lists it even though the owner was not told.
      expect(await listOpenRequests(other.ctx)).toHaveLength(1);
      answer = ok();
      expect(await startPayment(other.ctx, { account: ada, planId: "monthly", invoice: INVOICE })).toEqual(ok({ type: "requested" }));
      expect(await startPayment(other.ctx, { account: ada, planId: "monthly", invoice: INVOICE })).toEqual(ok({ type: "requested" }));
      expect(failing.requests).toHaveLength(2);
      expect(await listOpenRequests(other.ctx)).toHaveLength(1);
    } finally {
      log.mockRestore();
      await other.database.close();
    }
  });

  it("releases the hand-over when the provider throws, and lets the throw through", async () => {
    let shouldThrow = true;
    const throwing = createRecorder(() => (shouldThrow ? Promise.reject(new Error("smtp down")) : Promise.resolve(ok())));
    const other = await createTestBilling({ plans: PLANS, payment: throwing.provider });
    try {
      const ada = { id: await createAccount(other, "ada@example.com"), email: "ada@example.com" };
      await expect(startPayment(other.ctx, { account: ada, planId: "monthly", invoice: INVOICE })).rejects.toThrow("smtp down");
      shouldThrow = false;
      expect(await startPayment(other.ctx, { account: ada, planId: "monthly", invoice: INVOICE })).toEqual(ok({ type: "requested" }));
      expect(throwing.requests).toHaveLength(2);
    } finally {
      await other.database.close();
    }
  });

  it("throws when a provider's answer contradicts handsOverRequests", async () => {
    const redirect = ok({ type: "redirect" as const, url: "https://pay.example.com/session/1" });
    const cases: [PaymentProvider, string][] = [
      [{ name: "liar", collectsInvoiceDetails: false, handsOverRequests: true, startPayment: () => Promise.resolve(redirect) }, 'provider "liar" sets handsOverRequests but answered redirect'],
      [{ name: "quiet", collectsInvoiceDetails: false, handsOverRequests: false, startPayment: () => Promise.resolve(ok({ type: "requested" as const })) }, 'provider "quiet" answered requested but does not set handsOverRequests'],
    ];
    for (const [provider, message] of cases) {
      const other = await createTestBilling({ plans: PLANS, payment: provider });
      try {
        const id = await createAccount(other, "ada@example.com");
        await expect(startPayment(other.ctx, { account: { id, email: "ada@example.com" }, planId: "monthly", invoice: INVOICE })).rejects.toThrow(message);
      } finally {
        await other.database.close();
      }
    }
  });

  it("skips the invoice details for a provider that collects its own, and passes its redirect on", async () => {
    const seen: PaymentRequest[] = [];
    const hosted: PaymentProvider = {
      name: "hosted",
      collectsInvoiceDetails: false,
      handsOverRequests: false,
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
      // A redirect is not a request handed over: nothing to list.
      expect(await listOpenRequests(other.ctx)).toEqual([]);
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
