// The join action without double opt-in: the channel the app resolves for the request, and the
// person's own unsubscribe link in the success answer. Next's request scope is replaced: the config
// and the database come from the test and `after` callbacks are dropped (the mail is tested elsewhere).
import type { SoftureConfig } from "@softure-ai/core";
import { getScopeFieldName, INITIAL_WAITLIST_FORM_STATE, type WaitlistOptionsInput } from "@softure-ai/waitlist";
import { joinWaitlistAction } from "@softure-ai/waitlist/next";
import { getSignup, type WaitlistContext } from "@softure-ai/waitlist/server";
import { afterEach, beforeEach, describe, expect, it, vi, type MockInstance } from "vitest";
import { createTestWaitlist, OPTIONS, type TestWaitlist } from "./support.js";

interface RequestScope {
  config: SoftureConfig | undefined;
  context: WaitlistContext | undefined;
}

const scope = vi.hoisted((): RequestScope => ({ config: undefined, context: undefined }));

vi.mock("@softure-ai/core/next", () => ({
  getSoftureConfig: () => {
    if (scope.config === undefined) throw new Error("test: no config registered");
    return scope.config;
  },
}));
vi.mock("next/headers", () => ({ headers: () => Promise.resolve(new Headers({ "x-real-ip": "192.0.2.10" })) }));
vi.mock("next/navigation", () => ({ redirect: () => undefined }));
vi.mock("next/server", () => ({ after: () => undefined }));
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
});
