// `@softure-ai/mcp-access/scripts`: ops scripts that open and close OAuth dynamic client
// registration while `oauth.registration` is "closed" (see the README, "Closed registration").
export {
  createCloseClientRegistrationScript,
  createOpenClientRegistrationScript,
  type CloseClientRegistrationScriptArgs,
  type OpenClientRegistrationScriptArgs,
  type RegistrationScriptOptions,
} from "./registration-scripts.js";
