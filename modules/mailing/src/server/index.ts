// Server-only logic of @softure-ai/mailing. Functions receive a context and never read request
// scope; `next/*` imports are not allowed here (ESLint `no-restricted-imports`, NFR-3).
export { getCampaignProblems, parseCampaignFile, parseRecipientList, type CampaignContent, type CampaignFile, type CampaignFileResult } from "./campaign-file.js";
export {
  getCampaignContentHash,
  listConfiguredCampaignRecipients,
  planCampaign,
  registerCampaign,
  sendCampaign,
  type CampaignErrorCode,
  type CampaignHalt,
  type CampaignPlan,
  type CampaignSummary,
  type SendCampaignOptions,
} from "./campaigns.js";
export {
  DEFAULT_MAX_ATTEMPTS,
  DEFAULT_STALE_CLAIM_MS,
  DEFAULT_UNCERTAIN_CLAIM_MS,
  deliverOnce,
  isDeliveryScope,
  type DeliverOptions,
  type Delivery,
  type DeliveryContext,
  type DeliveryOutcome,
  type HaltingErrorCode,
} from "./deliveries.js";
export {
  checkSenderDns,
  DEFAULT_DKIM_SELECTORS,
  getSenderDomain,
  RESEND_RETURN_PATH_DOMAIN,
  resendReturnPath,
  type CheckSenderDnsOptions,
  type DmarcAlignment,
  type DmarcExpectation,
  type DmarcPolicy,
  type DnsCheck,
  type DnsCheckStatus,
  type DnsFinding,
  type MxRecord,
  type ResolveCname,
  type ResolveMx,
  type ResolveTxt,
  type ReturnPathHost,
  type SenderDnsReport,
} from "./dns.js";
export { checkMailingTables } from "./health.js";
export {
  checkImportedDeliveries,
  importDeliveries,
  type ImportCheck,
  type ImportedDelivery,
  type ImportedRejectionReason,
  type ImportProblem,
  type ImportResult,
  type ImportSummary,
} from "./import-deliveries.js";
export { addHtmlFooter, addTextFooter, getListUnsubscribeHeaders, SIGNATURE_SEPARATOR } from "./list-mail.js";
export { getMailingModule, getMailingOptions, getMailingRoutes, type MailingRoutes } from "./options.js";
export { sendMail, type MailContext } from "./send-mail.js";
export { isSuppressed, liftSuppression, suppressRecipient, unsubscribe, type SuppressionContext } from "./suppressions.js";
export {
  buildUnsubscribeLinks,
  getRecipientKey,
  getUnsubscribeLinkParams,
  MAX_LEGACY_VALUE_LENGTH,
  readUnsubscribeLink,
  MIN_UNSUBSCRIBE_SECRET_LENGTH,
  readUnsubscribeSecrets,
  readUnsubscribeToken,
  RECIPIENT_PARAM,
  signRecipientKey,
  SIGNATURE_PARAM,
  UNSUBSCRIBE_PREVIOUS_SECRET_ENV,
  UNSUBSCRIBE_SECRET_ENV,
  verifyUnsubscribeToken,
  type Env,
  type LinkParams,
  type UnsubscribeLink,
  type UnsubscribeLinks,
  type UnsubscribeSecrets,
  type UnsubscribeToken,
} from "./unsubscribe-link.js";
export { validateMail, type MailValidation, type ValidMail } from "./validate-mail.js";
