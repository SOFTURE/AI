// The `onJoined` hook: called once per sign-up, in its transaction, when it counts for the first
// time (at once, or when its link is used), and never for repeat requests. And the confirmation
// link's rewrite, which may add to the link but never stop it confirming.
import { getEmailKey } from "@softure-ai/privacy/server";
import { waitlist, type OnJoinedHook, type WaitlistJoinedEvent } from "@softure-ai/waitlist";
import {
  confirmSignup,
  deliverConfirmationMail,
  getConfirmationLink,
  getSignup,
  joinWaitlist,
  resolveConfirmationLink,
  type JoinWaitlistInput,
  type PendingSignup,
} from "@softure-ai/waitlist/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CLIENT, createTestWaitlist, listConsentRows, NOW, OPTIONS, type TestWaitlist } from "./support.js";

const ADA = "ada@example.com";
const JOIN: JoinWaitlistInput = { email: ADA, scopes: ["launch"], placement: "hero", clientKey: CLIENT };

interface HookCall {
  readonly event: WaitlistJoinedEvent;
  /** Whether the hook ran inside a transaction (pglite's transaction object is not the database). */
  readonly isInTransaction: boolean;
}

let test: TestWaitlist | undefined;

afterEach(async () => {
  await test?.database.close();
  test = undefined;
  vi.restoreAllMocks();
});

/** A waitlist whose hook records its calls. */
async function createWithHook(options: { doubleOptIn?: boolean; onJoined?: OnJoinedHook } = {}): Promise<{ test: TestWaitlist; calls: HookCall[] }> {
  const calls: HookCall[] = [];
  const created: TestWaitlist = await createTestWaitlist({
    waitlist: {
      ...OPTIONS,
      doubleOptIn: options.doubleOptIn ?? false,
      onJoined:
        options.onJoined ??
        ((event, ctx) => {
          calls.push({ event, isInTransaction: ctx.db !== created.database.db });
        }),
    },
  });
  test = created;
  return { test: created, calls };
}

async function requestSignup(target: TestWaitlist, input: Partial<JoinWaitlistInput> = {}): Promise<PendingSignup> {
  const result = await joinWaitlist(target.ctx, { ...JOIN, ...input });
  if (!result.ok || result.value.status !== "confirmation_required") throw new Error("expected a request that waits for its link");
  return result.value;
}

describe("onJoined without double opt-in", () => {
  it("is called once for a new sign-up, inside its transaction, and not for a repeat that widens the scopes", async () => {
    const { test: target, calls } = await createWithHook();
    const joined = await joinWaitlist(target.ctx, JOIN);
    await joinWaitlist(target.ctx, { ...JOIN, scopes: ["launch", "newsletter"] });
    await joinWaitlist(target.ctx, JOIN);

    if (!joined.ok || joined.value.status !== "joined") throw new Error("expected the sign-up to be applied");
    expect(calls).toEqual([{ event: { signup: joined.value.signup, via: "join" }, isInTransaction: true }]);
  });

  it("is called when a row left unconfirmed by an earlier double opt-in counts at once", async () => {
    const { test: target, calls } = await createWithHook();
    await target.database.client.query(
      `INSERT INTO waitlist.signups (email, scopes, placement, locale, created_at, updated_at, pending_scopes, confirmation_token_hash, confirmation_expires_at)
       VALUES ($1, '{launch}', 'hero', 'en', $2, $2, '{launch}', repeat('a', 64), $2::timestamptz + interval '1 hour')`,
      [ADA, NOW],
    );

    const joined = await joinWaitlist(target.ctx, JOIN);
    expect(joined.ok && joined.value.status === "joined" && joined.value.isNew).toBe(false);
    expect(calls.map((call) => [call.event.via, call.event.signup.email, call.event.signup.confirmedAt])).toEqual([["join", ADA, NOW]]);
  });

  it("rolls the sign-up back when the hook throws", async () => {
    const { test: target } = await createWithHook({
      onJoined: () => {
        throw new Error("the app's hook failed");
      },
    });
    await expect(joinWaitlist(target.ctx, JOIN)).rejects.toThrow("the app's hook failed");
    expect(await getSignup(target.ctx, ADA)).toBeNull();
    expect(await listConsentRows(target, getEmailKey(ADA))).toEqual([]);
  });
});

describe("onJoined with double opt-in", () => {
  it("is not called for the request, once for the first use of its link, and not for a second request or a reused link", async () => {
    const { test: target, calls } = await createWithHook({ doubleOptIn: true });
    const first = await requestSignup(target);
    expect(calls).toEqual([]);

    await confirmSignup(target.ctx, { token: first.token, clientKey: CLIENT });
    await confirmSignup(target.ctx, { token: first.token, clientKey: CLIENT });
    const second = await requestSignup(target, { scopes: ["launch", "newsletter"] });
    await confirmSignup(target.ctx, { token: second.token, clientKey: CLIENT });

    expect(calls.map((call) => ({ via: call.event.via, scopes: call.event.signup.scopes, confirmedAt: call.event.signup.confirmedAt, isInTransaction: call.isInTransaction }))).toEqual([
      { via: "confirmation", scopes: ["launch"], confirmedAt: NOW, isInTransaction: true },
    ]);
  });

  it("leaves the link unused when the hook throws, so it can be used again", async () => {
    let hasFailed = false;
    const { test: target } = await createWithHook({
      doubleOptIn: true,
      onJoined: () => {
        if (hasFailed) return;
        hasFailed = true;
        throw new Error("the app's hook failed");
      },
    });
    const pending = await requestSignup(target);

    await expect(confirmSignup(target.ctx, { token: pending.token, clientKey: CLIENT })).rejects.toThrow("the app's hook failed");
    expect((await getSignup(target.ctx, ADA))?.confirmedAt).toBeNull();
    const retried = await confirmSignup(target.ctx, { token: pending.token, clientKey: CLIENT });
    expect(retried.ok && retried.value.isFirstConfirmation).toBe(true);
  });
});

describe("waitlist options", () => {
  it("refuses an onJoined or rewriteConfirmationLink that is not a function", () => {
    expect(() => waitlist({ ...OPTIONS, onJoined: "count" as unknown as OnJoinedHook })).toThrow("options.onJoined: must be a function");
    expect(() => waitlist({ ...OPTIONS, rewriteConfirmationLink: "/x" as never })).toThrow("options.rewriteConfirmationLink: must be a function");
  });
});

describe("rewriteConfirmationLink", () => {
  const TOKEN = "a".repeat(43);

  async function createWithRewrite(rewrite: (path: string) => unknown): Promise<TestWaitlist> {
    test = await createTestWaitlist({ waitlist: { ...OPTIONS, doubleOptIn: true, rewriteConfirmationLink: rewrite as (path: string) => string } });
    return test;
  }

  it("mails the rewritten link, on the app's origin", async () => {
    const target = await createWithRewrite(async (path) => Promise.resolve(`${path}&z=newsletter`));
    expect(await resolveConfirmationLink(target.config, TOKEN)).toBe(`https://app.example.com/waitlist/confirm?token=${TOKEN}&z=newsletter`);

    const pending = await requestSignup(target);
    expect((await deliverConfirmationMail(target.ctx, pending.signup, pending.token)).ok).toBe(true);
    expect(target.provider.sent[0]?.text.split("\n").at(-1)).toBe(`https://app.example.com/waitlist/confirm?token=${pending.token}&z=newsletter`);
  });

  it.each([
    ["another origin", () => `https://evil.example.com/waitlist/confirm?token=${TOKEN}`],
    ["a protocol-relative path", () => `//evil.example.com/waitlist/confirm?token=${TOKEN}`],
    ["a backslash path", () => `/\\evil.example.com/waitlist/confirm?token=${TOKEN}`],
    ["another route", () => `/elsewhere?token=${TOKEN}`],
    ["a dropped token", () => "/waitlist/confirm?z=newsletter"],
    ["a changed token", () => `/waitlist/confirm?token=${"b".repeat(43)}`],
    ["a repeated token", () => `/waitlist/confirm?token=${TOKEN}&token=${TOKEN}`],
    ["a value that is not a string", () => 42],
  ])("falls back to the module's link for %s", async (_name, rewrite) => {
    const target = await createWithRewrite(rewrite);
    const log = vi.spyOn(console, "error").mockImplementation(() => undefined);
    expect(await resolveConfirmationLink(target.config, TOKEN)).toBe(getConfirmationLink(target.config, TOKEN));
    expect(log).toHaveBeenCalledOnce();
  });

  it("falls back to the module's link when the rewrite throws, logging no detail", async () => {
    const target = await createWithRewrite(() => {
      throw new Error(`failed for ${TOKEN}`);
    });
    const log = vi.spyOn(console, "error").mockImplementation(() => undefined);
    expect(await resolveConfirmationLink(target.config, TOKEN)).toBe(getConfirmationLink(target.config, TOKEN));
    expect(log.mock.calls.flat().join(" ")).not.toContain(TOKEN);
  });
});
