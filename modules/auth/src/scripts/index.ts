// `@softure-ai/auth/scripts`: ops scripts that grant and revoke roles, set a temporary password and
// create an account, and the development seed account
// (see the README, "Roles", "Account recovery", "First account" and "Development seed").
export { createGrantRoleScript, createRevokeRoleScript, type RoleScriptArgs, type RoleScriptOptions } from "./role-scripts.js";
export {
  createSetTemporaryPasswordScript,
  type TemporaryPasswordScriptArgs,
  type TemporaryPasswordScriptOptions,
} from "./temporary-password.js";
export { createCreateAccountScript, type CreateAccountScriptArgs, type CreateAccountScriptOptions } from "./create-account.js";
export { runSeedAccount, type RunSeedAccountOptions } from "./seed-account.js";
