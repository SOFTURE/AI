// The Next.js adapter of @softure-ai/auth: pages, server actions, the session route and the
// current-user helpers (docs/02-module-standard.md §8). The route guard is `@softure-ai/auth/proxy`.
export { changePasswordAction, loginAction, logoutAction, registerAction } from "./actions.js";
export { getCurrentUser, requireUser, type RequireUserOptions } from "./current-user.js";
export { LogoutButton, type LogoutButtonProps } from "./logout-button.js";
export { getAuthMessages } from "./messages.js";
export { type AuthPageProps, ChangePasswordPage, LoginPage, RegisterPage } from "./pages.js";
export { getSessionRoute } from "./route.js";
