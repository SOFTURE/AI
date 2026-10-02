"use server";

// The auth server actions. Each one identifies the client and counts its attempt (inside the
// server functions) before any work, reads the user from the session cookie (never from a bound
// argument, which the client controls, docs/02 §8), and turns unexpected failures into
// `safeError` codes. Next refuses an action whose Origin does not match the host.
import { errorLogLabel, safeError, type SoftureConfig } from "@softure-ai/core";
import { getSoftureConfig } from "@softure-ai/core/next";
import { identifyClient } from "@softure-ai/security/server";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import type { AuthFormErrorCode, AuthFormField, AuthFormState } from "../contract.js";
import { toSafeNextPath } from "../safe-next-path.js";
import { changePassword } from "../server/change-password.js";
import { loginUser } from "../server/login.js";
import { getAuthRoutes } from "../server/options.js";
import { registerUser } from "../server/register.js";
import { logoutSession } from "../server/sessions.js";
import { getAuthContext } from "./context.js";
import { clearSessionCookie, readSessionToken, writeSessionCookie } from "./session-cookie.js";

/** Longer values are cut: the server functions refuse them anyway, and nothing huge is echoed back. */
const MAX_FIELD_LENGTH = 4096;
const text = z
  .string()
  .catch("")
  .transform((value) => value.slice(0, MAX_FIELD_LENGTH));

const loginInput = z.object({ email: text, password: text, next: text });
const registerInput = z.object({ email: text, password: text, next: text, consent: z.string().nullable().catch(null) });
const changePasswordInput = z.object({ currentPassword: text, newPassword: text });

const FIELD_OF: Partial<Record<AuthFormErrorCode, AuthFormField>> = {
  "auth.email_invalid": "email",
  "auth.email_taken": "email",
  "auth.password_too_short": "password",
  "auth.password_too_long": "password",
  "auth.consent_required": "consent",
};

const CHANGE_FIELD_OF: Partial<Record<AuthFormErrorCode, AuthFormField>> = {
  "auth.current_password_invalid": "currentPassword",
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
  redirect(toSafeNextPath(input.next, getAuthRoutes(config).afterLogin));
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
    });
  } catch (error) {
    return failure(reportFailure("registration", error), { email: input.email });
  }
  if (!result.ok) return failure(result.error, { field: FIELD_OF[result.error], email: input.email });

  await endPreviousSession(config);
  await writeSessionCookie(config, result.value.session);
  redirect(toSafeNextPath(input.next, getAuthRoutes(config).afterLogin));
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

/** Ends the session the browser held before a login or register, so it cannot be reused. */
async function endPreviousSession(config: SoftureConfig): Promise<void> {
  const previous = await readSessionToken(config);
  if (previous === null) return;
  try {
    await logoutSession(await getAuthContext(config), previous);
  } catch (error) {
    reportFailure("ending the previous session", error);
  }
}

/** Ends the request's session and goes to `afterLogout`. The cookie is cleared even if the delete fails. */
export async function logoutAction(): Promise<void> {
  const config = getSoftureConfig();
  const token = await readSessionToken(config);
  if (token !== null) {
    try {
      await logoutSession(await getAuthContext(config), token);
    } catch (error) {
      reportFailure("logout", error);
    }
  }
  await clearSessionCookie(config);
  redirect(getAuthRoutes(config).afterLogout);
}
