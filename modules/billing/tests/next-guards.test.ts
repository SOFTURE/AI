// The guards of the Next adapter with Next's request scope replaced: the session cookie comes from a
// stubbed `cookies()`, the config from the test, and `getConfiguredDatabase` hands auth's and billing's
// real contexts the PGlite test database, so the real session and role checks run. The wall clock
// (`systemClock`, which both contexts use) is pinned to the test's instant. Every server action is
// called as an anonymous visitor, a member and an admin; `requireWriteAccess` without a session, on
// a trial and read-only.
import { getSessionCookie } from "@softure-ai/auth";
import { grantRole, registerUser } from "@softure-ai/auth/server";
import { manual, type BillingOptionsInput } from "@softure-ai/billing";
import {
  dismissRequestAction,
  extendTrialAction,
  findAccountAction,
  grantPlanAction,
  grantRequestAction,
  requireWriteAccess,
  revokeGrantAction,
  startPaymentAction,
} from "@softure-ai/billing/next";
import { grantPlanManually, recordPaymentRequest } from "@softure-ai/billing/server";
import { ok, type SoftureConfig } from "@softure-ai/core";
import type { Database } from "@softure-ai/db";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CLIENT, createTestBilling, NOW, type TestBilling } from "./support.js";

interface RequestScope {
  config: SoftureConfig | undefined;
  db: Database | undefined;
  readonly cookies: Map<string, string>;
  readonly revalidated: string[];
}

const scope = vi.hoisted((): RequestScope => ({ config: undefined, db: undefined, cookies: new Map(), revalidated: [] }));

class RedirectSignal extends Error {
  constructor(readonly location: string) {
    super(`redirect ${location}`);
  }
}

vi.mock("@softure-ai/core/next", () => ({
  getSoftureConfig: () => {
    if (scope.config === undefined) throw new Error("test: no config registered");
    return scope.config;
  },
}));
vi.mock("@softure-ai/db", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@softure-ai/db")>()),
  getConfiguredDatabase: () => {
    if (scope.db === undefined) throw new Error("test: no database registered");
    return Promise.resolve({ db: scope.db });
  },
}));
vi.mock("next/headers", () => ({
  cookies: () => Promise.resolve({ get: (name: string) => (scope.cookies.has(name) ? { name, value: scope.cookies.get(name) } : undefined) }),
}));
vi.mock("next/navigation", () => ({
  redirect: (location: string) => {
    throw new RedirectSignal(location);
  },
  notFound: () => {
    throw new Error("test: notFound");
  },
}));
vi.mock("next/cache", () => ({
  revalidatePath: (path: string) => {
    scope.revalidated.push(path);
  },
}));

const PLANS: BillingOptionsInput["plans"] = [{ id: "monthly", name: { en: "Monthly" }, price: { amount: 2900, currency: "PLN" }, period: "month" }];
const PASSWORD = "correct horse battery";
const ADMIN_PAGE = "/admin/billing";
const FORBIDDEN = { status: "error", error: "auth.forbidden" } as const;
const INVOICE = { invoiceName: "Ada Lovelace Ltd", invoiceTaxId: "", invoiceAddress: "1 Analytical Way, London" };

function createForm(fields: Readonly<Record<string, string>>): FormData {
  const form = new FormData();
  for (const [name, value] of Object.entries(fields)) form.set(name, value);
  return form;
}

/** Runs `call` and returns where it redirected; fails when it returns instead. */
async function readRedirect(call: () => Promise<unknown>): Promise<string> {
  try {
    await call();
  } catch (error) {
    if (error instanceof RedirectSignal) return error.location;
    throw error;
  }
  throw new Error("test: expected a redirect");
}

type Caller = "anonymous" | "member" | "admin";

describe("the Next adapter's guards", () => {
  let test: TestBilling;
  let ada: { id: string; token: string };
  let admin: { id: string; token: string };

  async function register(email: string): Promise<{ id: string; token: string }> {
    const registered = await registerUser(test.ctx, { email, password: PASSWORD, hasConsented: false, clientKey: CLIENT });
    if (!registered.ok) throw new Error(`setup: registration failed with ${registered.error}`);
    return { id: registered.value.user.id, token: registered.value.session.token };
  }

  function signInAs(caller: Caller): void {
    scope.cookies.clear();
    if (caller === "anonymous") return;
    scope.cookies.set(getSessionCookie(test.config).name, caller === "admin" ? admin.token : ada.token);
  }

  async function countRows(table: string, condition: string): Promise<number> {
    const result = await test.database.client.query<{ count: number }>(`SELECT count(*)::int AS count FROM ${table} WHERE ${condition}`);
    return result.rows[0]?.count ?? 0;
  }

  beforeEach(async () => {
    vi.useFakeTimers({ toFake: ["Date"], now: NOW });
    test = await createTestBilling({ plans: PLANS, payment: manual({ onRequest: () => Promise.resolve(ok()) }) });
    scope.config = test.config;
    scope.db = test.database.db;
    ada = await register("ada@example.com");
    admin = await register("grace@example.com");
    const granted = await grantRole(test.ctx, { userId: admin.id, role: "admin" });
    if (!granted.ok) throw new Error(`setup: granting the admin role failed with ${granted.error}`);
  });
  afterEach(async () => {
    scope.cookies.clear();
    scope.revalidated.length = 0;
    vi.useRealTimers();
    await test.database.close();
  });

  describe("grantPlanAction", () => {
    const grant = () => grantPlanAction({ status: "idle" }, createForm({ email: "ada@example.com", plan: "monthly" }));

    it.each(["anonymous", "member"] as const)("refuses %s before reading the form and grants nothing", async (caller) => {
      signInAs(caller);
      expect(await grant()).toEqual(FORBIDDEN);
      expect(await countRows("billing.manual_grants", "true")).toBe(0);
      expect(await countRows("billing.entitlements", "true")).toBe(0);
      expect(scope.revalidated).toEqual([]);
    });

    it("grants the plan for an admin and refreshes the admin page", async () => {
      signInAs("admin");
      expect(await grant()).toMatchObject({ status: "granted", planId: "monthly" });
      expect(await countRows("billing.manual_grants", `user_id = '${ada.id}' AND granted_by = '${admin.id}'`)).toBe(1);
      expect(scope.revalidated).toEqual([ADMIN_PAGE]);
    });
  });

  describe("extendTrialAction", () => {
    const extend = (lastDay = "2026-10-31", email = "ada@example.com") => extendTrialAction({ status: "idle" }, createForm({ email, trialLastDay: lastDay }));

    it.each(["anonymous", "member"] as const)("refuses %s before reading the form and extends nothing", async (caller) => {
      signInAs(caller);
      expect(await extend()).toEqual(FORBIDDEN);
      expect(await countRows("billing.trial_extensions", "true")).toBe(0);
      expect(await countRows("billing.entitlements", "true")).toBe(0);
      expect(scope.revalidated).toEqual([]);
    });

    it("extends the trial through the last day in the app's time zone for an admin and refreshes the admin page", async () => {
      signInAs("admin");
      expect(await extend()).toEqual({ status: "extended", notice: "ada@example.com now has a trial until October 31, 2026." });
      expect(
        await countRows("billing.trial_extensions", `user_id = '${ada.id}' AND extended_by = '${admin.id}' AND ends_at = '2026-10-31T23:00:00Z'`),
      ).toBe(1);
      expect(await countRows("billing.entitlements", `user_id = '${ada.id}' AND paid_until IS NULL`)).toBe(1);
      expect(scope.revalidated).toEqual([ADMIN_PAGE]);
    });

    it.each([
      ["a malformed day", "31.10.2026", "ada@example.com", "billing.day_invalid"],
      ["an impossible day", "2026-02-30", "ada@example.com", "billing.day_invalid"],
      ["a day the trial already covers", "2026-10-10", "ada@example.com", "billing.trial_not_extended"],
      ["a day in the past", "2026-10-01", "ada@example.com", "billing.end_not_in_future"],
      ["an unknown email", "2026-10-31", "nobody@example.com", "billing.account_unknown"],
    ])("answers %s with its code and echoes the form", async (_case, lastDay, email, error) => {
      signInAs("admin");
      expect(await extend(lastDay, email)).toEqual({ status: "error", error, email, lastDay });
      expect(await countRows("billing.trial_extensions", "true")).toBe(0);
      expect(scope.revalidated).toEqual([]);
    });
  });

  describe("grantRequestAction and dismissRequestAction", () => {
    let requestId: string;

    beforeEach(async () => {
      requestId = await recordPaymentRequest(test.ctx, { userId: ada.id, planId: "monthly", invoice: null, price: { amount: 2900, currency: "PLN" } });
    });

    const actions = [
      ["grantRequestAction", grantRequestAction],
      ["dismissRequestAction", dismissRequestAction],
    ] as const;

    it.each(actions)("%s refuses anonymous and member callers and leaves the request open", async (_name, action) => {
      for (const caller of ["anonymous", "member"] as const) {
        signInAs(caller);
        expect(await action({ status: "idle" }, createForm({ request: requestId }))).toEqual(FORBIDDEN);
      }
      expect(await countRows("billing.payment_requests", `id = '${requestId}' AND status = 'open'`)).toBe(1);
      expect(await countRows("billing.manual_grants", "true")).toBe(0);
      expect(scope.revalidated).toEqual([]);
    });

    it("grants the request for an admin", async () => {
      signInAs("admin");
      expect(await grantRequestAction({ status: "idle" }, createForm({ request: requestId }))).toEqual({ status: "done" });
      expect(await countRows("billing.payment_requests", `id = '${requestId}' AND status = 'granted'`)).toBe(1);
      expect(await countRows("billing.manual_grants", `request_id = '${requestId}'`)).toBe(1);
      expect(scope.revalidated).toEqual([ADMIN_PAGE]);
    });

    it("dismisses the request for an admin without a grant", async () => {
      signInAs("admin");
      expect(await dismissRequestAction({ status: "idle" }, createForm({ request: requestId }))).toEqual({ status: "done" });
      expect(await countRows("billing.payment_requests", `id = '${requestId}' AND status = 'dismissed'`)).toBe(1);
      expect(await countRows("billing.manual_grants", "true")).toBe(0);
      expect(scope.revalidated).toEqual([ADMIN_PAGE]);
    });
  });

  describe("revokeGrantAction", () => {
    let grantId: string;

    beforeEach(async () => {
      const granted = await grantPlanManually(test.ctx, { userId: ada.id, planId: "monthly", adminId: admin.id });
      if (!granted.ok) throw new Error(`setup: grant failed with ${granted.error}`);
      grantId = granted.value.grantId;
    });

    it.each(["anonymous", "member"] as const)("refuses %s and keeps the grant", async (caller) => {
      signInAs(caller);
      expect(await revokeGrantAction({ status: "idle" }, createForm({ grant: grantId }))).toEqual(FORBIDDEN);
      expect(await countRows("billing.manual_grants", `id = '${grantId}' AND status = 'active'`)).toBe(1);
      expect(scope.revalidated).toEqual([]);
    });

    it("revokes the grant for an admin", async () => {
      signInAs("admin");
      expect(await revokeGrantAction({ status: "idle" }, createForm({ grant: grantId }))).toEqual({ status: "done" });
      expect(await countRows("billing.manual_grants", `id = '${grantId}' AND status = 'revoked' AND revoked_by = '${admin.id}'`)).toBe(1);
      expect(scope.revalidated).toEqual([ADMIN_PAGE]);
    });
  });

  describe("findAccountAction", () => {
    const find = () => findAccountAction({ status: "idle" }, createForm({ email: "ada@example.com" }));

    it.each(["anonymous", "member"] as const)("refuses %s without echoing the email", async (caller) => {
      signInAs(caller);
      expect(await find()).toEqual(FORBIDDEN);
    });

    it("sends an admin to the account's history by its id", async () => {
      signInAs("admin");
      expect(await readRedirect(find)).toBe(`${ADMIN_PAGE}?account=${ada.id}`);
    });
  });

  describe("startPaymentAction", () => {
    const pay = () => startPaymentAction({ status: "idle" }, createForm({ plan: "monthly", ...INVOICE }));

    it("sends an anonymous visitor to the login page and back, and stores no request", async () => {
      signInAs("anonymous");
      expect(await readRedirect(pay)).toBe("/login?next=%2Fpayment");
      expect(await countRows("billing.payment_requests", "true")).toBe(0);
    });

    it("takes a member's request for the member's own account", async () => {
      signInAs("member");
      expect(await pay()).toEqual({ status: "requested" });
      expect(await countRows("billing.payment_requests", `user_id = '${ada.id}' AND status = 'open'`)).toBe(1);
    });
  });

  describe("requireWriteAccess", () => {
    it("sends a visitor without a session to the login page, with `next` when given", async () => {
      signInAs("anonymous");
      expect(await readRedirect(() => requireWriteAccess())).toBe("/login");
      expect(await readRedirect(() => requireWriteAccess({ next: "/notes" }))).toBe("/login?next=%2Fnotes");
    });

    it("lets an account on its trial write", async () => {
      signInAs("member");
      expect(await requireWriteAccess()).toEqual(
        ok({ user: expect.objectContaining({ id: ada.id }) as unknown, entitlement: { status: "trial", endsAt: new Date("2026-10-16T22:00:00Z"), daysLeft: 14, isEnding: false } }),
      );
    });

    it("refuses an account whose trial has ended with billing.read_only", async () => {
      vi.setSystemTime(new Date("2026-10-20T08:00:00Z"));
      signInAs("member");
      expect(await requireWriteAccess()).toEqual({ ok: false, error: "billing.read_only" });
    });
  });
});
