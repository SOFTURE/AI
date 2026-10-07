// `@softure-ai/auth/scripts`: ops scripts that grant and revoke roles and set a temporary password
// (see the README, "Roles" and "Account recovery").
export { createGrantRoleScript, createRevokeRoleScript, type RoleScriptArgs, type RoleScriptOptions } from "./role-scripts.js";
export {
  createSetTemporaryPasswordScript,
  type TemporaryPasswordScriptArgs,
  type TemporaryPasswordScriptOptions,
} from "./temporary-password.js";
