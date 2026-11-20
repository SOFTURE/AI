// @vitest-environment happy-dom
// The invitation surfaces of the Next adapter with Next's request scope replaced: the register page opened from a link,
// the admin page, and the actions behind them. Cookies live in a map and `redirect` throws with its URL.
import { authMessages, getSessionCookie, users } from "@softure-ai/auth";
import { InvitationsPage, inviteAction, registerAction, resendInvitationAction, revokeInvitationAction, RegisterPage } from "@softure-ai/auth/next";
import { createSession, findSessionUser, findUserRoles, grantRole, listInvitations } from "@softure-ai/auth/server";
import type { SoftureConfig } from "@softure-ai/core";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createTestAuth, NOW, PASSWORD, type ConfigOptions, type TestAuth } from "./support.js";

interface RequestScope {
  config: SoftureConfig | undefined;
  context: unknown;
  readonly cookies: Map<string, string>;
}

const scope = vi.hoisted((): RequestScope => ({ config: undefined, context: undefined, cookies: new Map() }));

class RedirectError extends Error {
  constructor(readonly url: string) {
    super(`redirect to ${url}`);
  }
}

vi.mock("@softure-ai/core/next", () => ({
  getSoftureConfig: () => {
    if (scope.config === undefined) throw new Error("test: no config registered");
    return scope.config;
  },
}));
vi.mock("next/headers", () => ({
  cookies: () =>
    Promise.resolve({
      get: (name: string) => (scope.cookies.has(name) ? { name, value: scope.cookies.get(name) } : undefined),
      set: (name: string, value: string, options: { maxAge?: number }) => {
        if (options.maxAge === 0) scope.cookies.delete(name);
        else scope.cookies.set(name, value);
      },
    }),
  headers: () => Promise.resolve(new Headers({ "x-real-ip": "192.0.2.10" })),
}));
vi.mock("next/navigation", () => ({
  notFound: () => {
    throw new Error("test: notFound");
  },
  redirect: (url: string) => {
    throw new RedirectError(url);
  },
}));
vi.mock("next/server", () => ({ after: () => undefined }));
vi.mock("../src/next/context.ts", () => ({ getAuthContext: () => Promise.resolve(scope.context) }));

const en = authMessages.en;
const INVITED = "grace@example.com";

function form(fields: Record<string, string>): FormData {
  const data = new FormData();
  for (const [name, value] of Object.entries(fields)) data.append(name, value);
  return data;
}

async function readRedirect(call: Promise<unknown>): Promise<string> {
  const error: unknown = await call.then(
    () => null,
    (reason: unknown) => reason,
  );
  if (!(error instanceof RedirectError)) throw new Error(`expected a redirect, got ${String(error)}`);
  return error.url;
}

describe("invitations in the Next adapter", () => {
  let test: TestAuth;
  let links: string[];
  let adminId: string;

  function recordLink(link: string): Promise<void> {
    links.push(link);
    return Promise.resolve();
  }

  async function setUp(options: ConfigOptions = {}): Promise<void> {
    links = [];
    vi.spyOn(console, "info").mockImplementation(() => undefined);
    test = await createTestAuth({
      ...options,
      auth: { registrationClosed: true, requireConsent: false, roles: ["editor"], invitations: { send: recordLink }, ...options.auth },
    });
    scope.config = test.config;
    scope.context = test.ctx;
    scope.cookies.clear();
    const [admin] = await test.ctx.db
      .insert(users)
      .values({ email: "owner@example.com", passwordHash: "scrypt$unused", createdAt: NOW, passwordChangedAt: NOW })
      .returning();
    if (admin === undefined) throw new Error("setup: no admin row");
    adminId = admin.id;
  }

  async function signInAsAdmin(): Promise<void> {
    await grantRole(test.ctx, { userId: adminId, role: "admin" });
    const session = await createSession(test.ctx, adminId);
    scope.cookies.set(getSessionCookie(test.config).name, session.token);
  }

  /** Invites through the admin action and returns the link's token. */
  async function inviteThroughPage(fields: Record<string, string> = { email: INVITED, "role-editor": "on" }): Promise<string> {
    expect(await readRedirect(inviteAction({ status: "idle" }, form(fields)))).toBe("/admin/invitations?notice=sent");
    const token = new URL(links.at(-1) ?? "").searchParams.get("invitation");
    if (token === null) throw new Error("no link sent");
    return token;
  }

  afterEach(async () => {
    cleanup();
    vi.restoreAllMocks();
    await test.database.close();
  });

  it("refuses the invite action to anyone who is not an admin, before reading the form", async () => {
    await setUp();
    expect(await inviteAction({ status: "idle" }, form({ email: INVITED }))).toEqual({ status: "error", error: "auth.forbidden" });
    const session = await createSession(test.ctx, adminId);
    scope.cookies.set(getSessionCookie(test.config).name, session.token);
    expect(await inviteAction({ status: "idle" }, form({ email: INVITED }))).toEqual({ status: "error", error: "auth.forbidden" });
    expect(await revokeInvitationAction({ status: "idle" }, form({ id: "x" }))).toEqual({ status: "error", error: "auth.forbidden" });
    expect(links).toEqual([]);
  });

  it("invites with the ticked roles, and registers the invited email through the link while registration is closed", async () => {
    await setUp();
    await signInAsAdmin();
    const token = await inviteThroughPage();
    scope.cookies.clear();

    render(await RegisterPage({ searchParams: Promise.resolve({ invitation: token }) }));
    expect(screen.getByText(en.invitations.acceptTitle)).not.toBeNull();
    expect(screen.getByText(`You were invited as ${INVITED}. Choose a password to create your account.`)).not.toBeNull();
    expect(document.querySelector('input[type="hidden"][name="invitation"]')).toHaveProperty("value", token);
    expect(document.querySelector('input[type="hidden"][name="email"]')).toHaveProperty("value", INVITED);
    expect(document.querySelector('meta[name="referrer"]')).toHaveProperty("content", "same-origin");

    const target = await readRedirect(registerAction({ status: "idle" }, form({ invitation: token, email: INVITED, password: PASSWORD })));
    expect(target).toBe("/");
    const user = await findSessionUser(test.ctx, scope.cookies.get(getSessionCookie(test.config).name) ?? "");
    if (user === null) throw new Error("no session after acceptance");
    expect(user.email).toBe(INVITED);
    expect([...(await findUserRoles(test.ctx, user))]).toEqual(["editor"]);
  });

  it("shows a wrong email on the form as a form error and creates no account", async () => {
    await setUp();
    await signInAsAdmin();
    const token = await inviteThroughPage();
    const state = await registerAction({ status: "idle" }, form({ invitation: token, email: "mallory@example.com", password: PASSWORD }));
    expect(state).toEqual({ status: "error", error: "auth.invitation_email_mismatch", field: "email", email: "mallory@example.com" });
  });

  it("answers a dead link with one neutral page that names no email", async () => {
    await setUp();
    await signInAsAdmin();
    const token = await inviteThroughPage();
    const [view] = await listInvitations(test.ctx);
    expect(await readRedirect(revokeInvitationAction({ status: "idle" }, form({ id: view?.id ?? "" })))).toBe("/admin/invitations?notice=revoked");

    for (const invitation of [token, "unknown"]) {
      render(await RegisterPage({ searchParams: Promise.resolve({ invitation }) }));
      expect(screen.getByText(en.invitations.invalidTitle)).not.toBeNull();
      expect(document.body.textContent).not.toContain(INVITED);
      expect(document.querySelector("form")).toBeNull();
      cleanup();
    }
    const state = await registerAction({ status: "idle" }, form({ invitation: token, email: INVITED, password: PASSWORD }));
    expect(state).toMatchObject({ status: "error", error: "auth.invitation_invalid" });
  });

  it("keeps the plain register page closed while registration is closed", async () => {
    await setUp();
    render(await RegisterPage({ searchParams: Promise.resolve({}) }));
    expect(screen.getByText(en.register.closedTitle)).not.toBeNull();
    const state = await registerAction({ status: "idle" }, form({ email: INVITED, password: PASSWORD }));
    expect(state).toMatchObject({ status: "error", error: "auth.registration_closed" });
  });

  it("lists invitations for an admin, with resend and revoke on a pending one", async () => {
    await setUp();
    await signInAsAdmin();
    await inviteThroughPage();
    render(await InvitationsPage({ searchParams: Promise.resolve({ notice: "sent" }) }));
    expect(screen.getByText(en.invitations.sent)).not.toBeNull();
    expect(screen.getByText(`${INVITED}: Pending`)).not.toBeNull();
    expect(screen.getByText("Roles: editor")).not.toBeNull();
    expect(screen.getByRole("button", { name: en.invitations.resend })).not.toBeNull();
    expect(screen.getByRole("button", { name: en.invitations.revoke })).not.toBeNull();
    expect(screen.getAllByRole("checkbox").map((box) => box.getAttribute("name"))).toEqual(["role-admin", "role-editor"]);

    const [view] = await listInvitations(test.ctx);
    expect(await readRedirect(resendInvitationAction({ status: "idle" }, form({ id: view?.id ?? "" })))).toBe("/admin/invitations?notice=resent");
    expect(links).toHaveLength(2);
  });

  it("is not found for a visitor without admin, and while invitations are off", async () => {
    await setUp();
    await expect(InvitationsPage({ searchParams: Promise.resolve({}) })).rejects.toThrow("test: notFound");
    await test.database.close();
    await setUp({ auth: { invitations: {} } });
    await signInAsAdmin();
    await expect(InvitationsPage({ searchParams: Promise.resolve({}) })).rejects.toThrow("test: notFound");
  });
});
