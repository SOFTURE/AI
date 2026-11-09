// The token manager, to compose into the app's own page. It takes the server actions from
// `@softure-ai/mcp-access/next` as props: no `next/*` import here (docs/02-module-standard.md §5).
export { ConsentError, ConsentForm, type ConsentErrorProps, type ConsentFormProps, type ConsentFormSlot } from "./consent-form.js";
export {
  TOKEN_MANAGER_SECTIONS,
  TokenManager,
  type TokenManagerApiScope,
  type RevokeGrantAction,
  type TokenManagerGrant,
  type IssueTokenAction,
  type RevokeTokenAction,
  type TokenManagerProps,
  type TokenManagerRow,
  type TokenManagerSection,
  type TokenManagerSlot,
  type TokenManagerTool,
} from "./token-manager.js";
