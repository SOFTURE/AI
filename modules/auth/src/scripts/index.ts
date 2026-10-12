// `@softure-ai/auth/scripts`: ops scripts that grant and revoke roles and set a temporary password,
// and the development seed account
// (see the README, "Roles", "Account recovery" and "Development seed").
export { createGrantRoleScript, createRevokeRoleScript, type RoleScriptArgs, type RoleScriptOptions } from "./role-scripts.js";
export {
  createSetTemporaryPasswordScript,
  type TemporaryPasswordScriptArgs,
  type TemporaryPasswordScriptOptions,
} from "./temporary-password.js";
export { runSeedAccount, type RunSeedAccountOptions } from "./seed-account.js";
