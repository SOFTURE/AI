// The Next.js adapter of @softure-ai/auth: pages, server actions, the session route and the
// current-user and role helpers (docs/02-module-standard.md §8). The route guard is `@softure-ai/auth/proxy`.
export {
  changePasswordAction,
  forgotPasswordAction,
  loginAction,
  logoutAction,
  registerAction,
  resetPasswordAction,
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
  LoginPage,
  RegisterPage,
  type RegisterPageOptions,
  ResetPasswordPage,
} from "./pages.js";
export { getSessionRoute } from "./route.js";
export type { PageSearchParams } from "./search-params.js";
