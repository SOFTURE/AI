import { createSession, findSessionUser, logoutSession, pruneSessions, registerUser } from "@softure-ai/auth/server";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { CLIENT, countRows, createTestAuth, DAY_MS, PASSWORD, type TestAuth } from "./support.js";

describe("sessions", () => {
  let test: TestAuth;
  let userId: string;
  let token: string;

  beforeEach(async () => {
    test = await createTestAuth({ auth: { session: { ttlDays: 7 } } });
    const registered = await registerUser(test.ctx, { email: "ada@example.com", password: PASSWORD, hasConsented: true, clientKey: CLIENT });
    if (!registered.ok) throw new Error(`setup: registration failed with ${registered.error}`);
    userId = registered.value.user.id;
    token = registered.value.session.token;
  });
  afterEach(async () => {
    await test.database.close();
  });

  it("finds the user until the configured TTL ends and not after", async () => {
    test.clock.advance(7 * DAY_MS - 1);
    expect((await findSessionUser(test.ctx, token))?.id).toBe(userId);
    test.clock.advance(1);
    expect(await findSessionUser(test.ctx, token)).toBeNull();
  });

  it.each([
    ["an empty token", ""],
    ["a token of the wrong shape", "not a token"],
    ["an unknown token of the right shape", "A".repeat(43)],
  ])("finds nobody for %s", async (_case, candidate) => {
    expect(await findSessionUser(test.ctx, candidate)).toBeNull();
  });

  it("logs out only the given session", async () => {
    const other = await createSession(test.ctx, userId);
    await logoutSession(test.ctx, token);
    expect(await findSessionUser(test.ctx, token)).toBeNull();
    expect((await findSessionUser(test.ctx, other.token))?.id).toBe(userId);
  });

  it("treats logging out an unknown or malformed token as done", async () => {
    await expect(logoutSession(test.ctx, "garbage")).resolves.toBeUndefined();
    await expect(logoutSession(test.ctx, "B".repeat(43))).resolves.toBeUndefined();
    expect(await countRows(test.database, "sessions")).toBe(1);
  });

  it("prunes expired sessions only, and reports how many", async () => {
    test.clock.advance(7 * DAY_MS);
    await createSession(test.ctx, userId);
    expect(await pruneSessions(test.ctx)).toBe(1);
    expect(await countRows(test.database, "sessions")).toBe(1);
    expect(await pruneSessions(test.ctx)).toBe(0);
  });
});
