// Invitations by email while registration is closed (issue #1406): issuing, accepting once, expiry, reuse, revoke, a
// wrong email, roles, the inviter and the rate limit.
import { AUTH_RATE_LIMIT_BUCKETS, invitations, users, type InvitationDetails, type RegisteredEvent } from "@softure-ai/auth";
import {
  findInvitation,
  findUserRoles,
  findSessionUser,
  getInvitationLink,
  inviteUser,
  isInvitationEnabled,
  listInvitations,
  registerInvitedUser,
  registerUser,
  resendInvitation,
  revokeInvitation,
} from "@softure-ai/auth/server";
import { eq } from "drizzle-orm";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CLIENT, countRows, createTestAuth, NOW, PASSWORD, type ConfigOptions, type TestAuth } from "./support.js";

const ADMIN_EMAIL = "owner@example.com";
const INVITED = "grace@example.com";
const HOUR_MS = 60 * 60 * 1000;

interface SentInvitation {
  readonly link: string;
  readonly email: string;
  readonly details: InvitationDetails;
}

describe("invitations", () => {
  let test: TestAuth;
  let sent: SentInvitation[];
  let adminId: string;

  function recordInvitation(link: string, recipient: { readonly email: string }, details: InvitationDetails): Promise<void> {
    sent.push({ link, email: recipient.email, details });
    return Promise.resolve();
  }

  async function setUp(options: ConfigOptions = {}): Promise<TestAuth> {
    sent = [];
    vi.spyOn(console, "info").mockImplementation(() => undefined);
    test = await createTestAuth({
      ...options,
      auth: { registrationClosed: true, roles: ["editor"], invitations: { send: recordInvitation }, ...options.auth },
    });
    const [admin] = await test.ctx.db
      .insert(users)
      .values({ email: ADMIN_EMAIL, passwordHash: "scrypt$unused", createdAt: NOW, passwordChangedAt: NOW })
      .returning();
    if (admin === undefined) throw new Error("setup: no admin row");
    adminId = admin.id;
    return test;
  }

  function tokenOf(link: string | undefined): string {
    const token = new URL(link ?? "").searchParams.get("invitation");
    if (token === null) throw new Error("the sent link has no token");
    return token;
  }

  async function invite(email = INVITED, roles: string[] = ["editor"]): Promise<string> {
    const result = await inviteUser(test.ctx, { email, roles, inviterId: adminId });
    if (!result.ok) throw new Error(`invite failed with ${result.error}`);
    return tokenOf(sent.at(-1)?.link);
  }

  function accept(token: string, email = INVITED) {
    return registerInvitedUser(test.ctx, { token, email, password: PASSWORD, hasConsented: true, clientKey: CLIENT });
  }

  afterEach(async () => {
    vi.restoreAllMocks();
    await test.database.close();
  });

  it("is off without a sender, and with one when passwords are off", async () => {
    await setUp({ auth: { invitations: {} } });
    expect(isInvitationEnabled(test.config)).toBe(false);
    expect(await inviteUser(test.ctx, { email: INVITED, roles: [], inviterId: adminId })).toEqual({ ok: false, error: "auth.invitations_unavailable" });
    await test.database.close();
    await setUp();
    expect(isInvitationEnabled(test.config)).toBe(true);
  });

  it("sends a link to the register page on the app origin, with the roles and expiry", async () => {
    await setUp();
    const token = await invite();
    expect(sent).toHaveLength(1);
    expect(sent[0]?.email).toBe(INVITED);
    expect(sent[0]?.link).toBe(getInvitationLink(test.config, token));
    expect(sent[0]?.link.startsWith("http://localhost:3000/register?invitation=")).toBe(true);
    expect(sent[0]?.details).toEqual({ expiresAt: new Date(NOW.getTime() + 72 * HOUR_MS), roles: ["editor"], locale: "en" });
  });

  it("stores only the hash of the token, with the inviter and the time", async () => {
    await setUp();
    const token = await invite();
    const [row] = await test.ctx.db.select().from(invitations);
    expect(row?.tokenHash).toMatch(/^[0-9a-f]{64}$/);
    expect(row?.tokenHash).not.toContain(token);
    expect(row?.invitedBy).toBe(adminId);
    expect(row?.createdAt).toEqual(NOW);
  });

  it("lets the invited email register exactly once while registration is closed", async () => {
    await setUp();
    const token = await invite();
    const closed = await registerUser(test.ctx, { email: INVITED, password: PASSWORD, hasConsented: true, clientKey: CLIENT });
    expect(closed).toEqual({ ok: false, error: "auth.registration_closed" });

    const result = await accept(token);
    if (!result.ok) throw new Error(`acceptance failed with ${result.error}`);
    expect(result.value.user.email).toBe(INVITED);
    expect(await findSessionUser(test.ctx, result.value.session.token)).toMatchObject({ email: INVITED });

    expect(await accept(token)).toEqual({ ok: false, error: "auth.invitation_invalid" });
    expect(await countRows(test.database, "users")).toBe(2);
  });

  it("refuses any other email on the form and creates no account", async () => {
    await setUp();
    const token = await invite();
    expect(await accept(token, "mallory@example.com")).toEqual({ ok: false, error: "auth.invitation_email_mismatch" });
    expect(await countRows(test.database, "users")).toBe(1);
    expect(await findInvitation(test.ctx, token)).toMatchObject({ email: INVITED });
  });

  it("refuses an expired link without revealing the email", async () => {
    await setUp();
    const token = await invite();
    test.clock.advance(72 * HOUR_MS);
    expect(await findInvitation(test.ctx, token)).toBeNull();
    expect(await accept(token)).toEqual({ ok: false, error: "auth.invitation_invalid" });
    expect(await countRows(test.database, "users")).toBe(1);
  });

  it("refuses a revoked link, and revokes only a pending invitation", async () => {
    await setUp();
    const token = await invite();
    const [view] = await listInvitations(test.ctx);
    if (view === undefined) throw new Error("no invitation listed");
    expect(await revokeInvitation(test.ctx, { invitationId: view.id, actorId: adminId })).toEqual({ ok: true, value: undefined });
    expect(await accept(token)).toEqual({ ok: false, error: "auth.invitation_invalid" });
    expect(await revokeInvitation(test.ctx, { invitationId: view.id, actorId: adminId })).toEqual({ ok: false, error: "auth.invitation_not_pending" });
    expect(await revokeInvitation(test.ctx, { invitationId: "not-a-uuid", actorId: adminId })).toEqual({ ok: false, error: "auth.invitation_not_pending" });
    expect((await listInvitations(test.ctx))[0]?.status).toBe("revoked");
  });

  it("refuses malformed and unknown tokens", async () => {
    await setUp();
    await invite();
    expect(await accept("short")).toEqual({ ok: false, error: "auth.invitation_invalid" });
    expect(await accept("A".repeat(43))).toEqual({ ok: false, error: "auth.invitation_invalid" });
  });

  it("grants the invited roles and records the acceptance", async () => {
    await setUp();
    const token = await invite(INVITED, ["editor", "admin"]);
    const result = await accept(token);
    if (!result.ok) throw new Error(`acceptance failed with ${result.error}`);
    expect([...(await findUserRoles(test.ctx, result.value.user))].sort()).toEqual(["admin", "editor"]);
    const [view] = await listInvitations(test.ctx);
    expect(view).toMatchObject({ status: "accepted", acceptedAt: NOW, invitedBy: { id: adminId, email: ADMIN_EMAIL }, roles: ["editor", "admin"] });
    const [row] = await test.ctx.db.select().from(invitations).where(eq(invitations.email, INVITED));
    expect(row?.acceptedUserId).toBe(result.value.user.id);
  });

  it("runs onRegistered in the registration transaction", async () => {
    const events: RegisteredEvent[] = [];
    await setUp({
      auth: {
        onRegistered: (event) => {
          events.push(event);
          return Promise.resolve();
        },
      },
    });
    const token = await invite();
    expect((await accept(token)).ok).toBe(true);
    expect(events.map((event) => event.user.email)).toEqual([INVITED]);
  });

  it("rolls the acceptance back when onRegistered throws, so the link still works", async () => {
    let shouldFail = true;
    await setUp({
      auth: {
        onRegistered: () => (shouldFail ? Promise.reject(new Error("consent store down")) : Promise.resolve()),
      },
    });
    const token = await invite();
    await expect(accept(token)).rejects.toThrow("consent store down");
    expect(await countRows(test.database, "users")).toBe(1);
    shouldFail = false;
    expect((await accept(token)).ok).toBe(true);
  });

  it("refuses an undeclared role and an email that already has an account", async () => {
    await setUp();
    expect(await inviteUser(test.ctx, { email: INVITED, roles: ["owner"], inviterId: adminId })).toEqual({ ok: false, error: "auth.role_undeclared" });
    expect(await inviteUser(test.ctx, { email: ADMIN_EMAIL, roles: [], inviterId: adminId })).toEqual({ ok: false, error: "auth.email_taken" });
    expect(await inviteUser(test.ctx, { email: "not an email", roles: [], inviterId: adminId })).toEqual({ ok: false, error: "auth.email_invalid" });
    expect(sent).toEqual([]);
  });

  it("refreshes the pending invitation of an email invited again, so the old link stops working", async () => {
    await setUp();
    const first = await invite(INVITED, []);
    const second = await invite(" Grace@Example.com ", ["editor"]);
    expect(await findInvitation(test.ctx, first)).toBeNull();
    expect(await findInvitation(test.ctx, second)).toMatchObject({ email: INVITED, roles: ["editor"] });
    expect(await listInvitations(test.ctx)).toHaveLength(1);
  });

  it("resends a pending invitation with a new link and expiry, and renews an expired one", async () => {
    await setUp();
    const first = await invite();
    test.clock.advance(80 * HOUR_MS);
    const [view] = await listInvitations(test.ctx);
    if (view === undefined) throw new Error("no invitation listed");
    expect(view.status).toBe("expired");
    expect(await resendInvitation(test.ctx, { invitationId: view.id, actorId: adminId })).toEqual({ ok: true, value: undefined });
    const second = tokenOf(sent.at(-1)?.link);
    expect(second).not.toBe(first);
    expect(await findInvitation(test.ctx, first)).toBeNull();
    expect((await accept(second)).ok).toBe(true);
    expect(await resendInvitation(test.ctx, { invitationId: view.id, actorId: adminId })).toEqual({ ok: false, error: "auth.invitation_not_pending" });
  });

  it("counts invites and resends in the invitation bucket of the admin", async () => {
    await setUp({ buckets: { invitation: { limit: 2, windowMinutes: 60 } } });
    await invite("a@example.com");
    await invite("b@example.com");
    const third = await inviteUser(test.ctx, { email: "c@example.com", roles: [], inviterId: adminId });
    expect(third).toMatchObject({ ok: false, error: "security.rate_limited" });
    expect(sent).toHaveLength(2);
  });

  it("counts acceptances in the register bucket", async () => {
    await setUp({ buckets: { register: { limit: 1, windowMinutes: 15 } } });
    const token = await invite();
    expect(await accept(token, "mallory@example.com")).toEqual({ ok: false, error: "auth.invitation_email_mismatch" });
    expect(await accept(token)).toMatchObject({ ok: false, error: "security.rate_limited" });
  });

  it("checks the form before the link and counts nothing for a malformed form", async () => {
    await setUp();
    const token = await invite();
    expect(await registerInvitedUser(test.ctx, { token, email: INVITED, password: "short", hasConsented: true, clientKey: CLIENT })).toEqual({
      ok: false,
      error: "auth.password_too_short",
    });
    expect(await registerInvitedUser(test.ctx, { token, email: INVITED, password: PASSWORD, hasConsented: false, clientKey: CLIENT })).toEqual({
      ok: false,
      error: "auth.consent_required",
    });
  });

  it("requires the invitation bucket only while invitations are on", async () => {
    const withoutInvitation = Object.fromEntries(Object.entries(AUTH_RATE_LIMIT_BUCKETS).filter(([name]) => name !== "invitation"));
    await setUp({ onlyBuckets: withoutInvitation });
    await expect(inviteUser(test.ctx, { email: INVITED, roles: [], inviterId: adminId })).rejects.toThrow('lacks "invitation"');
  });

  it("keeps one pending invitation per email and refuses malformed rows", async () => {
    await setUp();
    const insert = (email: string, roles: string, digit: string) =>
      test.database.client.query("INSERT INTO auth.invitations (email, roles, token_hash, created_at, expires_at) VALUES ($1, $2, $3, $4, $5)", [
        email,
        roles,
        digit.repeat(64),
        NOW,
        new Date(NOW.getTime() + HOUR_MS),
      ]);
    await insert(INVITED, "{editor}", "1");
    await expect(insert(INVITED, "{}", "2")).rejects.toThrow(/invitations_pending_email_key/);
    await expect(insert("Upper@example.com", "{}", "3")).rejects.toThrow(/check/i);
    await expect(insert("b@example.com", "{Editor}", "4")).rejects.toThrow(/check/i);
  });

  it("writes an audit line with ids only", async () => {
    await setUp();
    const token = await invite();
    const result = await accept(token);
    if (!result.ok) throw new Error(`acceptance failed with ${result.error}`);
    const lines = vi.mocked(console.info).mock.calls.map((call) => String(call[0]));
    expect(lines.some((line) => line.includes("audit invitation.invited") && line.includes(`by=${adminId}`))).toBe(true);
    expect(lines.some((line) => line.includes("audit invitation.accepted") && line.includes(`user=${result.value.user.id}`))).toBe(true);
    expect(lines.some((line) => line.includes(INVITED) || line.includes(token))).toBe(false);
  });
});
