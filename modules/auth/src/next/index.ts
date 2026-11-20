// The Next.js adapter of @softure-ai/auth: pages, server actions, the session route and the
// current-user and role helpers (docs/02-module-standard.md §8). The route guard is `@softure-ai/auth/proxy`.
export {
  changePasswordAction,
  forgotPasswordAction,
  inviteAction,
  loginAction,
  logoutAction,
  type LogoutInput,
  oidcSignInAction,
  registerAction,
  resendInvitationAction,
  resetPasswordAction,
  revokeInvitationAction,
} from "./actions.js";
export {
  authorizeRole,
  getCurrentUser,
  getCurrentUserRoles,
  hasRole,
  requireRole,
  requireUser,
  type RequireUserOptions,
} from "./current-user.js";
export { LogoutButton, type LogoutButtonProps } from "./logout-button.js";
export { getAuthMessages } from "./messages.js";
export {
  type AuthPageProps,
  ChangePasswordPage,
  createRegisterPage,
  ForgotPasswordPage,
  InvitationsPage,
  LoginPage,
  RegisterPage,
  type RegisterPageOptions,
  ResetPasswordPage,
  toInvitationRow,
} from "./pages.js";
export { oidcCallbackRoute } from "./oidc-route.js";
export { getSessionRoute } from "./route.js";
export type { PageSearchParams } from "./search-params.js";
