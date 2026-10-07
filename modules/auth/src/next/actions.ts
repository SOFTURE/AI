"use server";

// The auth server actions. Each one identifies the client and counts its attempt (inside the
// server functions) before any work, reads the user from the session cookie (never from a bound
// argument, which the client controls, docs/02 §8), and turns unexpected failures into
// `safeError` codes. Next refuses an action whose Origin does not match the host. Every redirect
// goes through the app's `rewriteRedirect` (`resolveRedirectTarget`).
import { errorLogLabel, safeError, type SoftureConfig } from "@softure-ai/core";
import { getSoftureConfig } from "@softure-ai/core/next";
import { identifyClient } from "@softure-ai/security/server";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { after } from "next/server";
import { z } from "zod";
import type { AuthFormErrorCode, AuthFormField, AuthFormState } from "../contract.js";
import { resolveRedirectTarget } from "../redirect-target.js";
import { MAX_NEXT_PATH_LENGTH, toSafeNextPath } from "../safe-next-path.js";
import { changePassword } from "../server/change-password.js";
import { getAuthOptions } from "../server/options.js";
import { loginUser } from "../server/login.js";
import { getAuthRoutes } from "../server/options.js";
import { deliverPasswordReset, requestPasswordReset, resetPassword } from "../server/password-reset.js";
import { registerUser } from "../server/register.js";
import { logoutSession } from "../server/sessions.js";
import { getAuthContext } from "./context.js";
import { PASSWORD_RESET_DONE_PARAM } from "./params.js";
import { clearSessionCookie, readLegacySessionToken, readSessionToken, writeSessionCookie } from "./session-cookie.js";

/** Longer values are cut: the server functions refuse them anyway, and nothing huge is echoed back. */
const MAX_FIELD_LENGTH = 4096;
const text = z
  .string()
  .catch("")
  .transform((value) => value.slice(0, MAX_FIELD_LENGTH));

// One character over the cap, so `toSafeNextPath` still sees an overlong path as overlong, not cut.
const nextPath = z
  .string()
  .catch("")
  .transform((value) => value.slice(0, MAX_NEXT_PATH_LENGTH + 1));

const loginInput = z.object({ email: text, password: text, next: nextPath });
const registerInput = z.object({ email: text, password: text, next: nextPath, consent: z.string().nullable().catch(null) });
const changePasswordInput = z.object({ currentPassword: text, newPassword: text });
const forgotPasswordInput = z.object({ email: text });
const resetPasswordInput = z.object({ token: text, newPassword: text });

const FIELD_OF: Partial<Record<AuthFormErrorCode, AuthFormField>> = {
  "auth.email_invalid": "email",
  "auth.email_taken": "email",
  "auth.password_too_short": "password",
  "auth.password_too_long": "password",
  "auth.consent_required": "consent",
};

const CHANGE_FIELD_OF: Partial<Record<AuthFormErrorCode, AuthFormField>> = {
  "auth.current_password_invalid": "currentPassword",
  "auth.password_unchanged": "newPassword",
  "auth.password_too_short": "newPassword",
  "auth.password_too_long": "newPassword",
};

const RESET_FIELD_OF: Partial<Record<AuthFormErrorCode, AuthFormField>> = {
  "auth.password_too_short": "newPassword",
  "auth.password_too_long": "newPassword",
};

function failure(error: AuthFormErrorCode, options: { field?: AuthFormField; email?: string } = {}): AuthFormState {
  return { status: "error", error, ...options };
}

function readForm<T extends z.ZodType>(schema: T, formData: FormData): z.output<T> {
  const raw = Object.fromEntries([...formData.keys()].map((key) => [key, formData.get(key)]));
  // Every field has a `catch`, so parsing cannot fail.
  return schema.parse(raw);
}

/** The app's declared registration fields the form sent as text; files and other names are ignored (the server cuts them to 512). */
function readRegistrationFields(config: SoftureConfig, formData: FormData): Record<string, string> {
  const fields: Record<string, string> = {};
  for (const name of getAuthOptions(config).registrationFields) {
    const value = formData.get(name);
    if (typeof value === "string") fields[name] = value.slice(0, MAX_FIELD_LENGTH);
  }
  return fields;
}

function reportFailure(operation: string, error: unknown): AuthFormErrorCode {
  console.error(`@softure-ai/auth: ${operation} failed: ${errorLogLabel(error)}`);
  return safeError(error).error;
}

export async function loginAction(_previous: AuthFormState, formData: FormData): Promise<AuthFormState> {
  const config = getSoftureConfig();
  const input = readForm(loginInput, formData);
  const client = identifyClient({ config }, await headers());
  if (!client.ok) return failure(client.error, { email: input.email });

  let result;
  try {
    result = await loginUser(await getAuthContext(config), { email: input.email, password: input.password, clientKey: client.value });
  } catch (error) {
    return failure(reportFailure("login", error), { email: input.email });
  }
  if (!result.ok) return failure(result.error, { email: input.email });

  await endPreviousSession(config);
  await writeSessionCookie(config, result.value.session);
  redirect(await resolveRedirectTarget(config, toSafeNextPath(input.next, getAuthRoutes(config).afterLogin)));
}

export async function registerAction(_previous: AuthFormState, formData: FormData): Promise<AuthFormState> {
  const config = getSoftureConfig();
  const input = readForm(registerInput, formData);
  const client = identifyClient({ config }, await headers());
  if (!client.ok) return failure(client.error, { email: input.email });

  let result;
  try {
    result = await registerUser(await getAuthContext(config), {
      email: input.email,
      password: input.password,
      // A checked HTML checkbox sends "on" (or its value); an unchecked one sends nothing.
      hasConsented: input.consent !== null,
      clientKey: client.value,
      fields: readRegistrationFields(config, formData),
    });
  } catch (error) {
    return failure(reportFailure("registration", error), { email: input.email });
  }
  if (!result.ok) return failure(result.error, { field: FIELD_OF[result.error], email: input.email });

  await endPreviousSession(config);
  await writeSessionCookie(config, result.value.session);
  redirect(await resolveRedirectTarget(config, toSafeNextPath(input.next, getAuthRoutes(config).afterLogin)));
}

export async function changePasswordAction(_previous: AuthFormState, formData: FormData): Promise<AuthFormState> {
  const config = getSoftureConfig();
  const input = readForm(changePasswordInput, formData);
  const token = await readSessionToken(config);
  if (token === null) return failure("auth.unauthenticated");

  try {
    const result = await changePassword(await getAuthContext(config), {
      sessionToken: token,
      currentPassword: input.currentPassword,
      newPassword: input.newPassword,
    });
    return result.ok ? { status: "ok" } : failure(result.error, { field: CHANGE_FIELD_OF[result.error] });
  } catch (error) {
    return failure(reportFailure("password change", error));
  }
}

/**
 * Asks for a reset link. The answer depends only on the buckets and the email's shape, never on
 * whether the account exists: the link is issued and handed to the app's sender after the
 * response, so neither the sender's time nor its failure shows here.
 */
export async function forgotPasswordAction(_previous: AuthFormState, formData: FormData): Promise<AuthFormState> {
  const config = getSoftureConfig();
  const input = readForm(forgotPasswordInput, formData);
  const client = identifyClient({ config }, await headers());
  if (!client.ok) return failure(client.error, { email: input.email });

  let result;
  try {
    result = await requestPasswordReset(await getAuthContext(config), { email: input.email, clientKey: client.value });
  } catch (error) {
    return failure(reportFailure("password reset request", error), { email: input.email });
  }
  if (!result.ok) return failure(result.error, { field: FIELD_OF[result.error], email: input.email });

  const { email } = result.value;
  after(async () => {
    try {
      await deliverPasswordReset(await getAuthContext(config), email);
    } catch (error) {
      reportFailure("password reset delivery", error);
    }
  });
  return { status: "ok" };
}

/**
 * Sets a new password with the token from a reset link, then goes to the login page, which says so.
 * A redirect, not an `ok` state: without JavaScript the reset page renders again after the action,
 * and its token is used by then.
 */
export async function resetPasswordAction(_previous: AuthFormState, formData: FormData): Promise<AuthFormState> {
  const config = getSoftureConfig();
  const input = readForm(resetPasswordInput, formData);
  const client = identifyClient({ config }, await headers());
  if (!client.ok) return failure(client.error);

  let result;
  try {
    result = await resetPassword(await getAuthContext(config), {
      token: input.token,
      newPassword: input.newPassword,
      clientKey: client.value,
    });
  } catch (error) {
    return failure(reportFailure("password reset", error));
  }
  if (!result.ok) return failure(result.error, { field: RESET_FIELD_OF[result.error] });
  redirect(await resolveRedirectTarget(config, `${getAuthRoutes(config).login}?${PASSWORD_RESET_DONE_PARAM}=1`));
}

/** Every session token the browser holds: the current cookie's and a legacy session's. */
async function readHeldTokens(config: SoftureConfig): Promise<string[]> {
  const tokens = [await readSessionToken(config), await readLegacySessionToken(config)];
  return [...new Set(tokens.filter((token) => token !== null))];
}

/** Ends the sessions the browser held before a login or register, so they cannot be reused. */
async function endPreviousSession(config: SoftureConfig): Promise<void> {
  for (const previous of await readHeldTokens(config)) {
    try {
      await logoutSession(await getAuthContext(config), previous);
    } catch (error) {
      reportFailure("ending the previous session", error);
    }
  }
}

/** Where to go after logout: a path on this app, checked like login's `next`. */
export interface LogoutInput {
  readonly next?: string;
}

// Any client can call the action with any serializable value: only a `next` string counts.
const logoutInput = z.object({ next: nextPath }).catch({ next: "" });

/** The `next` of a posted form or of an object; anything else is no target. */
function readLogoutNext(input: unknown): string {
  if (input instanceof FormData) return logoutInput.parse({ next: input.get("next") }).next;
  return logoutInput.parse(input).next;
}

/**
 * Ends the request's sessions and goes to `next` (a form field or `{ next }`, e.g. `/login?next=…` to
 * sign in as someone else), else to `afterLogout`. The cookies are cleared even if the delete fails.
 */
export async function logoutAction(input?: FormData | LogoutInput): Promise<void> {
  const config = getSoftureConfig();
  const target = toSafeNextPath(readLogoutNext(input), getAuthRoutes(config).afterLogout);
  for (const token of await readHeldTokens(config)) {
    try {
      await logoutSession(await getAuthContext(config), token);
    } catch (error) {
      reportFailure("logout", error);
    }
  }
  await clearSessionCookie(config);
  redirect(await resolveRedirectTarget(config, target));
}
