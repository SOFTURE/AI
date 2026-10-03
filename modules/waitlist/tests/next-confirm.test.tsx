// The Next adapter with double opt-in: the join action mails the link, the confirmation page shows a
// button without touching the database, and its action confirms and redirects. Next's request scope
// is replaced: the config and the database come from the test, `redirect` throws what it was given
// and `after` callbacks run when the test says so.
import type { SoftureConfig } from "@softure-ai/core";
import { INITIAL_WAITLIST_FORM_STATE, waitlistMessages } from "@softure-ai/waitlist";
import { confirmSignupAction, ConfirmSignupPage, joinWaitlistAction } from "@softure-ai/waitlist/next";
import { getEmailKey } from "@softure-ai/privacy/server";
import { getScopeFieldName } from "@softure-ai/waitlist";
import type { WaitlistContext } from "@softure-ai/waitlist/server";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi, type MockInstance } from "vitest";
import { createTestWaitlist, listConsentRows, NOW, OPTIONS, SECRET, type TestWaitlist } from "./support.js";

interface RequestScope {
  config: SoftureConfig | undefined;
  context: WaitlistContext | undefined;
  pending: (() => Promise<void>)[];
}

const scope = vi.hoisted((): RequestScope => ({ config: undefined, context: undefined, pending: [] }));

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
vi.mock("next/navigation", () => ({
  redirect: (location: string) => {
    throw new RedirectSignal(location);
  },
}));
vi.mock("next/headers", () => ({ headers: () => Promise.resolve(new Headers({ "x-real-ip": "192.0.2.10" })) }));
vi.mock("next/server", () => ({
  after: (task: () => Promise<void>) => {
    scope.pending.push(task);
  },
}));
vi.mock("../src/next/context.ts", () => ({ getWaitlistContext: () => Promise.resolve(scope.context) }));

const copy = waitlistMessages.en;
const ADA = "ada@example.com";

async function runAfter(): Promise<void> {
  const tasks = scope.pending.splice(0);
  for (const task of tasks) await task();
}

function joinForm(email = ADA): FormData {
  const form = new FormData();
  form.set("email", email);
  form.set("placement", "hero");
  form.set(getScopeFieldName("launch"), "on");
  return form;
}

async function confirmWith(token: string): Promise<string> {
  const form = new FormData();
  form.set("token", token);
  try {
    await confirmSignupAction(form);
  } catch (error) {
    if (error instanceof RedirectSignal) return error.location;
    throw error;
  }
  throw new Error("test: the action did not redirect");
}

async function renderPage(query: Record<string, string>): Promise<string> {
  return renderToStaticMarkup(await ConfirmSignupPage({ searchParams: Promise.resolve(query) }));
}

/** The token in the link of the last confirmation mail. */
function readMailedToken(test: TestWaitlist): string {
  const text = test.provider.sent.at(-1)?.text ?? "";
  return /\?token=([A-Za-z0-9_-]{43})$/.exec(text)?.[1] ?? "";
}

describe("the waitlist adapter with double opt-in", () => {
  let test: TestWaitlist;
  let log: MockInstance<typeof console.error>;

  beforeEach(async () => {
    test = await createTestWaitlist({ waitlist: { ...OPTIONS, doubleOptIn: true } });
    scope.config = test.config;
    scope.context = test.ctx;
    scope.pending = [];
    vi.stubEnv("MAILING_UNSUBSCRIBE_SECRET", SECRET);
    log = vi.spyOn(console, "error").mockImplementation(() => undefined);
  });
  afterEach(async () => {
    await test.database.close();
    vi.unstubAllEnvs();
    log.mockRestore();
  });

  it("answers the form with confirmation_sent and mails the link after the answer", async () => {
    expect(await joinWaitlistAction(INITIAL_WAITLIST_FORM_STATE, joinForm())).toEqual({ status: "confirmation_sent" });
    expect(test.provider.sent).toEqual([]);
    await runAfter();
    expect(test.provider.sent.map((mail) => mail.subject)).toEqual([copy.confirmationMail.subject]);
    expect(readMailedToken(test)).toMatch(/^[A-Za-z0-9_-]{43}$/);
  });

  it("shows the button for a link without looking it up, and the outcome after a submit", async () => {
    const page = await renderPage({ token: "A".repeat(43) });
    expect(page).toContain(copy.confirm.title);
    expect(page).toContain(`name="token" value="${"A".repeat(43)}"`);
    expect(page).toContain('<meta name="referrer" content="same-origin"/>');
    expect(await renderPage({})).toContain(copy.confirm.invalidTitle);
    expect(await renderPage({ status: "invalid" })).toContain(copy.confirm.invalidTitle);
    expect(await renderPage({ status: "expired" })).toContain(copy.confirm.expiredTitle);
    expect(await renderPage({ status: "done" })).toContain(copy.confirm.doneTitle);
    expect(await renderPage({ status: "failed", token: "A".repeat(43) })).toContain(copy.confirm.failed);
    expect(await renderPage({ status: "limited", token: "A".repeat(43) })).toContain(copy.confirm.limited);
  });

  it("confirms the link, redirects to done and sends the welcome mail after the answer", async () => {
    await joinWaitlistAction(INITIAL_WAITLIST_FORM_STATE, joinForm());
    await runAfter();
    const token = readMailedToken(test);

    expect(await confirmWith(token)).toBe("/waitlist/confirm?status=done");
    expect((await listConsentRows(test, getEmailKey(ADA))).map((row) => [row.purpose, row.recorded_at])).toEqual([["launch", NOW]]);
    await runAfter();
    expect(test.provider.sent.map((mail) => mail.subject)).toEqual([copy.confirmationMail.subject, copy.welcomeMail.subject]);

    // A second click: still done, and no second welcome mail.
    expect(await confirmWith(token)).toBe("/waitlist/confirm?status=done");
    await runAfter();
    expect(test.provider.sent).toHaveLength(2);
  });

  it("redirects a link that does not work to invalid and an expired one to expired", async () => {
    expect(await confirmWith("not-a-token")).toBe("/waitlist/confirm?status=invalid");
    await joinWaitlistAction(INITIAL_WAITLIST_FORM_STATE, joinForm());
    await runAfter();
    test.clock.set(new Date(NOW.getTime() + 168 * 60 * 60 * 1000));
    expect(await confirmWith(readMailedToken(test))).toBe("/waitlist/confirm?status=expired");
  });

  it("keeps the token when the confirmation failed, and logs no part of it", async () => {
    await joinWaitlistAction(INITIAL_WAITLIST_FORM_STATE, joinForm());
    await runAfter();
    const token = readMailedToken(test);
    await test.database.client.exec("DROP TABLE waitlist.signups");
    expect(await confirmWith(token)).toBe(`/waitlist/confirm?status=failed&token=${token}`);
    expect(log.mock.calls.map((call) => call.join(" ")).join("\n")).not.toContain(token);
  });
});
