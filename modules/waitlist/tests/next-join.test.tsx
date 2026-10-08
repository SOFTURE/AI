// The join action without double opt-in: the channel the app resolves for the request, the
// person's own unsubscribe link in the success answer, and the same answer for a suppressed address. Next's request scope is replaced: the config
// and the database come from the test and `after` callbacks are dropped (the mail is tested elsewhere).
import type { SoftureConfig } from "@softure-ai/core";
import { getScopeFieldName, INITIAL_WAITLIST_FORM_STATE, type WaitlistOptionsInput } from "@softure-ai/waitlist";
import { joinWaitlistAction } from "@softure-ai/waitlist/next";
import { isSuppressed, readUnsubscribeToken, suppressRecipient, verifyUnsubscribeToken } from "@softure-ai/mailing/server";
import { getSignup, joinWaitlist, type WaitlistContext } from "@softure-ai/waitlist/server";
import { afterEach, beforeEach, describe, expect, it, vi, type MockInstance } from "vitest";
import { CLIENT, createTestWaitlist, OPTIONS, SECRET, type TestWaitlist } from "./support.js";

interface RequestScope {
  config: SoftureConfig | undefined;
  context: WaitlistContext | undefined;
  /** How many callbacks went to `after` (the mails). */
  afterCalls: number;
}

const scope = vi.hoisted((): RequestScope => ({ config: undefined, context: undefined, afterCalls: 0 }));

vi.mock("@softure-ai/core/next", () => ({
  getSoftureConfig: () => {
    if (scope.config === undefined) throw new Error("test: no config registered");
    return scope.config;
  },
}));
vi.mock("next/headers", () => ({ headers: () => Promise.resolve(new Headers({ "x-real-ip": "192.0.2.10" })) }));
vi.mock("next/navigation", () => ({ redirect: () => undefined }));
vi.mock("next/server", () => ({ after: () => void scope.afterCalls++ }));
vi.mock("../src/next/context.ts", () => ({ getWaitlistContext: () => Promise.resolve(scope.context) }));

const ADA = "ada@example.com";

function joinForm(email = ADA): FormData {
  const form = new FormData();
  form.set("email", email);
  form.set("placement", "hero");
  form.set(getScopeFieldName("launch"), "on");
  return form;
}

describe("the join action", () => {
  let test: TestWaitlist;
  let log: MockInstance<typeof console.error>;

  async function start(options: WaitlistOptionsInput): Promise<void> {
    test = await createTestWaitlist({ waitlist: options });
    scope.config = test.config;
    scope.context = test.ctx;
    scope.afterCalls = 0;
  }

  beforeEach(() => {
    log = vi.spyOn(console, "error").mockImplementation(() => undefined);
  });
  afterEach(async () => {
    await test.database.close();
    vi.unstubAllEnvs();
    log.mockRestore();
  });

  it("stores the channel the app resolves for the request", async () => {
    const resolveChannel = vi.fn(() => Promise.resolve("newsletter"));
    await start({ ...OPTIONS, resolveChannel });
    expect(await joinWaitlistAction(INITIAL_WAITLIST_FORM_STATE, joinForm())).toEqual({ status: "ok" });
    expect(resolveChannel).toHaveBeenCalledWith({ config: test.config });
    expect(await getSignup(test.ctx, ADA)).toMatchObject({ channel: "newsletter" });
  });

  it("signs up without a channel when the resolver throws or returns something the table cannot hold, and logs only the kind", async () => {
    await start({
      ...OPTIONS,
      resolveChannel: () => {
        throw new Error("secret detail");
      },
    });
    expect(await joinWaitlistAction(INITIAL_WAITLIST_FORM_STATE, joinForm())).toEqual({ status: "ok" });
    expect(await getSignup(test.ctx, ADA)).toMatchObject({ channel: null });
    expect(log.mock.calls.flat().join(" ")).not.toContain("secret detail");
    await test.database.close();

    await start({ ...OPTIONS, resolveChannel: () => "with space" });
    expect(await joinWaitlistAction(INITIAL_WAITLIST_FORM_STATE, joinForm())).toEqual({ status: "ok" });
    expect(await getSignup(test.ctx, ADA)).toMatchObject({ channel: null });
    expect(log).toHaveBeenLastCalledWith(expect.stringContaining("resolveChannel returned a value that is not a channel"));
  });

  it("stores no channel without a resolver", async () => {
    await start(OPTIONS);
    expect(await joinWaitlistAction(INITIAL_WAITLIST_FORM_STATE, joinForm())).toEqual({ status: "ok" });
    expect(await getSignup(test.ctx, ADA)).toMatchObject({ channel: null });
  });

  it("answers a sign-up with the person's own unsubscribe link when the app asks for it, for a new and a known address", async () => {
    vi.stubEnv("MAILING_UNSUBSCRIBE_SECRET", SECRET);
    await start({ ...OPTIONS, unsubscribeLinkOnSuccess: true });
    const first = await joinWaitlistAction(INITIAL_WAITLIST_FORM_STATE, joinForm());
    expect(first).toEqual({ status: "ok", unsubscribeUrl: expect.stringMatching(/^https:\/\/app\.example\.com\/[^?]+\?r=[\w-]{43}&t=[\w-]{43}$/) as unknown });
    const token = readUnsubscribeToken(new URL(first.unsubscribeUrl ?? "").searchParams);
    expect(token !== null && verifyUnsubscribeToken(token, { current: SECRET, previous: null })).toBe(true);
    expect(await joinWaitlistAction(INITIAL_WAITLIST_FORM_STATE, joinForm())).toEqual(first);
  });

  it("returns no link when the option is off, and none for a request waiting for its confirmation", async () => {
    vi.stubEnv("MAILING_UNSUBSCRIBE_SECRET", SECRET);
    await start(OPTIONS);
    expect(await joinWaitlistAction(INITIAL_WAITLIST_FORM_STATE, joinForm())).toEqual({ status: "ok" });
    await test.database.close();
    await start({ ...OPTIONS, unsubscribeLinkOnSuccess: true, doubleOptIn: true });
    expect(await joinWaitlistAction(INITIAL_WAITLIST_FORM_STATE, joinForm())).toEqual({ status: "confirmation_sent" });
  });

  it("answers a suppressed address exactly like a sign-up that counted, writes nothing and sends no mail", async () => {
    vi.stubEnv("MAILING_UNSUBSCRIBE_SECRET", SECRET);
    await start({ ...OPTIONS, unsubscribeLinkOnSuccess: true });
    const counted = await joinWaitlistAction(INITIAL_WAITLIST_FORM_STATE, joinForm("bob@example.com"));
    expect(scope.afterCalls).toBe(1);
    await suppressRecipient(test.ctx, ADA, "page");

    const suppressed = await joinWaitlistAction(INITIAL_WAITLIST_FORM_STATE, joinForm(" Ada@Example.com "));
    expect(suppressed).toEqual({ status: "ok", unsubscribeUrl: expect.stringMatching(/\?r=[\w-]{43}&t=[\w-]{43}$/) as unknown });
    expect(Object.keys(suppressed)).toEqual(Object.keys(counted));
    expect(scope.afterCalls).toBe(1);
    expect(await getSignup(test.ctx, ADA)).toBeNull();
    expect(await isSuppressed(test.ctx, ADA)).toBe(true);
  });

  it("refuses to run with the option and no unsubscribe secret", async () => {
    vi.stubEnv("MAILING_UNSUBSCRIBE_SECRET", "");
    await start({ ...OPTIONS, unsubscribeLinkOnSuccess: true });
    await expect(joinWaitlist(test.ctx, { email: ADA, scopes: ["launch"], placement: "hero", clientKey: CLIENT })).rejects.toThrow(
      "@softure-ai/waitlist: unsubscribeLinkOnSuccess needs MAILING_UNSUBSCRIBE_SECRET (at least 32 characters) to sign the link",
    );
  });
});
