// Server-only API of @softure-ai/privacy. Every function receives the module context
// (`{ db, clock, config }`) and never reads request scope; the user id comes in as a value.
export { collectUserData, type CollectedUserData, type CollectUserDataResult } from "./collect.js";
export type { PrivacyContext } from "./context.js";
export {
  getDeletingContributors,
  getExportingContributors,
  getPrivacyContributors,
  type DeletingContributor,
  type ExportingContributor,
  type RegisteredContributor,
} from "./contributors.js";
export { eraseUserData, type EraseUserDataResult } from "./erase.js";
export { getPrivacyOptions, getPrivacyRoutes, type PrivacyRoutes } from "./options.js";
export {
  deleteOwnAccount,
  exportOwnData,
  type DeleteOwnAccountErrorCode,
  type DeleteOwnAccountInput,
  type DeleteOwnAccountResult,
  type ExportOwnDataInput,
  type ExportOwnDataResult,
} from "./self-service.js";
