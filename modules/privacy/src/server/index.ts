// Server-only API of @softure-ai/privacy. Every function receives the module context
// (`{ db, clock, config }`) and never reads request scope; the user id comes in as a value.
export {
  getConsent,
  getEmailKey,
  hasConsent,
  importConsent,
  listConsents,
  recordConsent,
  type ConsentQuery,
  type ImportConsentInput,
  type RecordConsentInput,
  type RecordConsentResult,
} from "./consents.js";
export {
  deleteConsentUserData,
  exportConsentUserData,
  privacyConsentsContributor,
  type PrivacyUserData,
} from "./consents-contributor.js";
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
export { findLegalDocument, getDocumentVersionAt, getLegalDocument, getLegalDocuments } from "./legal-documents.js";
export { getPrivacyOptions, getPrivacyRoutes, type PrivacyRoutes } from "./options.js";
export { recordRegistrationConsent, REGISTRATION_SOURCE, type RegistrationConsentOptions } from "./registration-consent.js";
export {
  deleteOwnAccount,
  exportOwnData,
  type DeleteOwnAccountErrorCode,
  type DeleteOwnAccountInput,
  type DeleteOwnAccountResult,
  type ExportOwnDataInput,
  type ExportOwnDataResult,
} from "./self-service.js";
export {
  copyAccount,
  type CopiedTable,
  type CopyAccountErrorCode,
  type CopyAccountFailure,
  type CopyAccountInclude,
  type CopyAccountInput,
  type CopyAccountReport,
  type CopyAccountResult,
} from "./copy-account.js";
