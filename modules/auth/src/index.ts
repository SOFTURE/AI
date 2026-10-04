// Public API of @softure-ai/auth: the module factory for softure.config.ts, its types, messages and
// tables, and the development reset sender. Database work is in `@softure-ai/auth/server`, the Next.js adapter in `/next`, the route
// guard in `/proxy`, the forms in `/ui` and the role scripts in `/scripts`.
import { defineModule, resolveMigrationsDir } from "@softure-ai/core";
import { authMessages } from "./messages/index.js";
import { authOptionsSchema } from "./options.js";
import { checkAuthTables } from "./server/health.js";
import { authPrivacyContributor } from "./server/privacy.js";

export const MODULE_ID = "auth";

/** Name of the runtime switch that closes registration. */
export const REGISTRATION_CLOSED_SWITCH = "auth.registration_closed";

/**
 * The env override of that switch: `true`/`1` or `false`/`0` while auth reads it itself. When the app
 * defines the switch in `@softure-ai/feature-switches`, that module reads the same variable.
 */
export const REGISTRATION_CLOSED_ENV = "SOFTURE_SWITCH_AUTH_REGISTRATION_CLOSED";

/**
 * Rate limit buckets auth consumes, with defaults to spread into `security({ buckets })`:
 * `register` and `login` per client address, `login-account` per email, `change-password` per user,
 * `password-reset` (link requests) and `password-reset-confirm` (new passwords) per client address,
 * and `password-reset-account` per email, which bounds the mails one address can receive.
 */
export const AUTH_RATE_LIMIT_BUCKETS = {
  register: { limit: 5, windowMinutes: 15 },
  login: { limit: 50, windowMinutes: 15 },
  "login-account": { limit: 10, windowMinutes: 15 },
  "change-password": { limit: 10, windowMinutes: 15 },
  "password-reset": { limit: 10, windowMinutes: 15 },
  "password-reset-account": { limit: 3, windowMinutes: 15 },
  "password-reset-confirm": { limit: 10, windowMinutes: 15 },
} as const;

/**
 * Enables accounts in `softure.config.ts` (next to `security({ ... })`):
 * `auth({ routes: { afterLogin: "/dashboard" }, password: { minLength: 12 } })`.
 */
export const auth = defineModule({
  manifest: {
    id: MODULE_ID,
    version: "0.0.0",
    dependsOn: { security: "^0.0.0" },
    dbSchema: "auth",
    tables: ["users", "sessions", "user_roles", "password_resets"],
    env: [
      {
        name: REGISTRATION_CLOSED_ENV,
        required: false,
        description: "Overrides the auth.registration_closed switch: true or 1 closes registration, false or 0 opens it.",
      },
    ],
    switches: [REGISTRATION_CLOSED_SWITCH],
    routes: {
      login: "/login",
      register: "/register",
      changePassword: "/account/password",
      forgotPassword: "/forgot-password",
      resetPassword: "/reset-password",
      afterLogin: "/",
      afterLogout: "/login",
    },
    mount: [
      { kind: "page", path: "app/login/page.tsx", export: "LoginPage" },
      { kind: "page", path: "app/register/page.tsx", export: "RegisterPage" },
      { kind: "page", path: "app/account/password/page.tsx", export: "ChangePasswordPage" },
      { kind: "page", path: "app/forgot-password/page.tsx", export: "ForgotPasswordPage" },
      { kind: "page", path: "app/reset-password/page.tsx", export: "ResetPasswordPage" },
      { kind: "route-handler", path: "app/api/auth/session/route.ts", export: "getSessionRoute" },
      { kind: "middleware", path: "proxy.ts", export: "createAuthGuard" },
    ],
    privacy: { exports: true, deletes: true },
  },
  messages: authMessages,
  options: authOptionsSchema,
  migrations: { dir: resolveMigrationsDir(import.meta.url, "../migrations/") },
  privacy: authPrivacyContributor,
  health: checkAuthTables,
});

export { INITIAL_AUTH_FORM_STATE } from "./contract.js";
export type {
  AuthErrorCode,
  AuthFormErrorCode,
  AuthFormField,
  AuthFormState,
  AuthUser,
  NewSession,
  RegisteredEvent,
  SignedIn,
} from "./contract.js";
export { authMessages, getAuthErrorMessage, type AuthMessages } from "./messages/index.js";
export type { AuthOptions, AuthOptionsInput, OnRegisteredHook, RewriteRedirect, ScryptParams } from "./options.js";
export { consolePasswordResetSender, type PasswordResetDetails, type PasswordResetSender } from "./password-reset-sender.js";
export { getSessionCookie, type SessionCookie } from "./session-cookie.js";
export { toSafeNextPath } from "./safe-next-path.js";
export { ADMIN_ROLE, ROLE_NAME_PATTERN } from "./roles.js";
export { passwordResets, sessions, userRoles, users } from "./schema.js";
