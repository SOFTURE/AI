// Re-authentication before an irreversible action: the current password, or a fresh provider sign-in that opened
// the request's own session.
import {
  completeOidcSignIn,
  createSession,
  findLinkedProviders,
  findRecentProviderSignIn,
  isCurrentPassword,
  loginUser,
  registerUser,
  startOidcSignIn,
} from "@softure-ai/auth/server";
import { createFakeOidcProvider, type FakeOidcUser } from "@softure-ai/auth/testing";
import { afterEach, describe, expect, it } from "vitest";
import { CLIENT, createTestAuth, NOW, PASSWORD, type TestAuth } from "./support.js";

const ADA: FakeOidcUser = { subject: "sub-ada", email: "ada@example.com" };
const MINUTE_MS = 60 * 1000;

let open: TestAuth | undefined;

afterEach(async () => {
  await open?.database.close();
  open = undefined;
});

async function setUp() {
  const clockHolder: { now: () => Date } = { now: () => NOW };
  const fake = createFakeOidcProvider({ clock: { now: () => clockHolder.now() } });
  const test = await createTestAuth({ auth: { oidc: { providers: [fake.definition], fetch: fake.fetch } } });
  clockHolder.now = () => test.clock.now();
  open = test;
  const ctx = { ...test.ctx, env: fake.env };
  const signIn = async (user: FakeOidcUser = ADA) => {
    const started = await startOidcSignIn(ctx, { provider: "fake", clientKey: CLIENT });
    if (!started.ok) throw new Error(started.error);
    const callback = fake.signIn(started.value.url, user);
    const done = await completeOidcSignIn(ctx, {
      provider: "fake",
      params: { state: callback.searchParams.get("state"), code: callback.searchParams.get("code"), error: callback.searchParams.get("error") },
      browserState: started.value.state,
      clientKey: CLIENT,
    });
    if (!done.ok) throw new Error(done.error);
    return done.value;
  };
  return { test, ctx, signIn };
}

describe("findRecentProviderSignIn", () => {
  it("names the provider whose sign-in opened this session within the window", async () => {
    const { test, signIn } = await setUp();
    const { user, session } = await signIn();
    test.clock.advance(9 * MINUTE_MS);
    expect(await findRecentProviderSignIn(test.ctx, { userId: user.id, sessionToken: session.token, withinMinutes: 10 })).toBe("fake");
  });

  it("is null once the window has passed", async () => {
    const { test, signIn } = await setUp();
    const { user, session } = await signIn();
    test.clock.advance(10 * MINUTE_MS + 1);
    expect(await findRecentProviderSignIn(test.ctx, { userId: user.id, sessionToken: session.token, withinMinutes: 10 })).toBeNull();
  });

  it("is null for a session a password login opened, even right after a provider sign-in elsewhere", async () => {
    const { test, signIn } = await setUp();
    const { user } = await signIn();
    test.clock.advance(2 * MINUTE_MS);
    const session = await createSession(test.ctx, user.id);
    expect(await findRecentProviderSignIn(test.ctx, { userId: user.id, sessionToken: session.token, withinMinutes: 10 })).toBeNull();
  });

  it("is null for another user's session and for a malformed token", async () => {
    const { test, signIn } = await setUp();
    const { session } = await signIn();
    const grace = await signIn({ subject: "sub-grace", email: "grace@example.com" });
    expect(await findRecentProviderSignIn(test.ctx, { userId: grace.user.id, sessionToken: session.token, withinMinutes: 10 })).toBeNull();
    expect(await findRecentProviderSignIn(test.ctx, { userId: grace.user.id, sessionToken: "not-a-token", withinMinutes: 10 })).toBeNull();
  });

  it("is null for an account that signs in with a password only", async () => {
    const { test } = await setUp();
    const registered = await registerUser(test.ctx, { email: "ada@example.com", password: PASSWORD, hasConsented: true, clientKey: CLIENT });
    if (!registered.ok) throw new Error(registered.error);
    const login = await loginUser(test.ctx, { email: "ada@example.com", password: PASSWORD, clientKey: CLIENT });
    if (!login.ok) throw new Error(login.error);
    expect(await findRecentProviderSignIn(test.ctx, { userId: registered.value.user.id, sessionToken: login.value.session.token, withinMinutes: 10 })).toBeNull();
  });
});

describe("findLinkedProviders and isCurrentPassword", () => {
  it("lists the account's providers; a provider-created account has no password anyone knows", async () => {
    const { test, signIn } = await setUp();
    const { user } = await signIn();
    expect(await findLinkedProviders(test.ctx, user.id)).toEqual(["fake"]);
    expect(await isCurrentPassword(test.ctx, user.id, "")).toBe(false);
  });

  it("lists none for a password account", async () => {
    const { test } = await setUp();
    const registered = await registerUser(test.ctx, { email: "ada@example.com", password: PASSWORD, hasConsented: true, clientKey: CLIENT });
    if (!registered.ok) throw new Error(registered.error);
    expect(await findLinkedProviders(test.ctx, registered.value.user.id)).toEqual([]);
  });
});
