// Server-only API of @softure-ai/auth. Every function receives the module context
// (`{ db, clock, config }`) and never reads request scope; tokens and client keys come in as values.
export { changePassword, type ChangePasswordErrorCode, type ChangePasswordInput, type ChangePasswordResult } from "./change-password.js";
export { loginUser, type LoginInput, type LoginResult } from "./login.js";
export { getAuthOptions, getAuthRoutes, type AuthRoutes } from "./options.js";
export { hashPassword, isPasswordHash, matchPassword, MAX_PASSWORD_LENGTH, needsRehash, verifyPassword, type PasswordMatch } from "./password.js";
export {
  deliverPasswordReset,
  findPasswordResetUser,
  getPasswordResetLink,
  isPasswordResetEnabled,
  issuePasswordReset,
  prunePasswordResets,
  requestPasswordReset,
  resetPassword,
  RESET_TOKEN_PARAM,
  type PasswordResetRequestInput,
  type PasswordResetRequestResult,
  type ResetPasswordErrorCode,
  type ResetPasswordInput,
  type ResetPasswordResult,
} from "./password-reset.js";
export {
  assertDeclaredRole,
  findUserRoles,
  getDeclaredRoles,
  grantRole,
  isConfiguredAdmin,
  isDeclaredRole,
  revokeRole,
  type RoleChange,
  type RoleErrorCode,
} from "./roles.js";
export { authPrivacyContributor, deleteAuthUserData, exportAuthUserData, type AuthUserData } from "./privacy.js";
export { isCurrentPassword } from "./reauthenticate.js";
export { registerUser, type RegisterErrorCode, type RegisterInput, type RegisterResult } from "./register.js";
export {
  createSession,
  findSessionUser,
  logoutSession,
  pruneSessions,
  revokeUserSessions,
  type AuthContext,
  type RevokeUserSessionsOptions,
} from "./sessions.js";
export { isRegistrationClosed } from "./switches.js";
export { createTemporaryPassword, READABLE_PASSWORD_ALPHABET, type TemporaryPasswordOptions } from "./temporary-password.js";
