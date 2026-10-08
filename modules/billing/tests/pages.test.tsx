// The payment and admin pages, rendered to HTML with Next's request scope replaced as in
// next-guards.test.ts: each has one `<h1>`, first in its `<main>`, from the messages by default,
// replaced or left out through `heading`. The admin page has the trial card and lists a trial
// extension in the account's history.
import { getSessionCookie } from "@softure-ai/auth";
import { grantRole, registerUser } from "@softure-ai/auth/server";
import { billingMessages, manual, type BillingOptionsInput } from "@softure-ai/billing";
import { BillingAdminPage, PaymentPage } from "@softure-ai/billing/next";
import { extendTrialManually } from "@softure-ai/billing/server";
import { ok, type SoftureConfig } from "@softure-ai/core";
import type { Database } from "@softure-ai/db";
import type { ReactNode } from "react";
import { prerender } from "react-dom/static";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CLIENT, createTestBilling, NOW, type TestBilling } from "./support.js";

interface RequestScope {
  config: SoftureConfig | undefined;
  db: Database | undefined;
  readonly cookies: Map<string, string>;
}

const scope = vi.hoisted((): RequestScope => ({ config: undefined, db: undefined, cookies: new Map() }));

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
    throw new Error(`test: redirect ${location}`);
  },
  notFound: () => {
    throw new Error("test: notFound");
  },
}));
vi.mock("next/cache", () => ({ revalidatePath: () => undefined }));

const PLANS: BillingOptionsInput["plans"] = [{ id: "monthly", name: { en: "Monthly" }, price: { amount: 2900, currency: "PLN" }, period: "month" }];
const en = billingMessages.en;

async function renderHtml(node: ReactNode): Promise<string> {
  const { prelude } = await prerender(node);
  return new Response(prelude).text();
}

/** The `<h1>` elements of the page, and whether the first child of `<main>` is one. */
function readHeadings(html: string): { readonly headings: string[]; readonly isFirstInMain: boolean } {
  const headings = [...html.matchAll(/<h1[^>]*>([^<]*)<\/h1>/g)].map((match) => match[1] ?? "");
  return { headings, isFirstInMain: /<main[^>]*><h1[ >]/.test(html) };
}

describe("the billing pages", () => {
  let test: TestBilling;
  let adaId: string;

  beforeEach(async () => {
    vi.useFakeTimers({ toFake: ["Date"], now: NOW });
    test = await createTestBilling({ plans: PLANS, payment: manual({ onRequest: () => Promise.resolve(ok()) }) });
    scope.config = test.config;
    scope.db = test.database.db;
    const ada = await registerUser(test.ctx, { email: "ada@example.com", password: "correct horse battery", hasConsented: false, clientKey: CLIENT });
    if (!ada.ok) throw new Error(`setup: registration failed with ${ada.error}`);
    adaId = ada.value.user.id;
    const granted = await grantRole(test.ctx, { userId: adaId, role: "admin" });
    if (!granted.ok) throw new Error(`setup: granting the admin role failed with ${granted.error}`);
    scope.cookies.set(getSessionCookie(test.config).name, ada.value.session.token);
  });
  afterEach(async () => {
    scope.cookies.clear();
    vi.useRealTimers();
    await test.database.close();
  });

  it.each([
    ["PaymentPage", (heading?: string | null) => PaymentPage({ heading }), en.payment.heading],
    ["BillingAdminPage", (heading?: string | null) => BillingAdminPage({ heading }), en.admin.heading],
  ] as const)("%s has one <h1> from the messages, first in <main>, replaced or left out through heading", async (_page, render, copy) => {
    expect(readHeadings(await renderHtml(await render()))).toEqual({ headings: [copy], isFirstInMain: true });
    expect(readHeadings(await renderHtml(await render("Plans")))).toEqual({ headings: ["Plans"], isFirstInMain: true });
    expect(readHeadings(await renderHtml(await render(null)))).toEqual({ headings: [], isFirstInMain: false });
  });

  it("offers the trial form and lists an extension in the account's history", async () => {
    await extendTrialManually(test.ctx, { userId: adaId, until: new Date("2026-10-31T23:00:00Z"), adminId: adaId });
    const html = await renderHtml(await BillingAdminPage({ searchParams: Promise.resolve({ account: adaId }) }));
    expect(html).toContain(en.admin.trial.title);
    expect(html).toContain('name="trialLastDay"');
    expect(html).toContain(en.admin.history.trialExtended);
    expect(html).toContain("Trial until October 31, 2026");
    expect(html).toContain("The trial was until October 16, 2026");
  });
});
