// Server-only API of @softure-ai/auth. Every function receives the module context
// (`{ db, clock, config }`) and never reads request scope; tokens and client keys come in as values.
export { changePassword, type ChangePasswordErrorCode, type ChangePasswordInput, type ChangePasswordResult } from "./change-password.js";
export { loginUser, type LoginInput, type LoginResult } from "./login.js";
export { getAuthOptions, getAuthRoutes, type AuthRoutes } from "./options.js";
export { hashPassword, MAX_PASSWORD_LENGTH, needsRehash, verifyPassword } from "./password.js";
export { registerUser, type RegisterErrorCode, type RegisterInput, type RegisterResult } from "./register.js";
export { createSession, findSessionUser, logoutSession, pruneSessions, type AuthContext } from "./sessions.js";
export { isRegistrationClosed } from "./switches.js";
