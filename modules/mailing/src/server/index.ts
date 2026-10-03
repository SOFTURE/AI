// Server-only logic of @softure-ai/mailing. Functions receive a context and never read request
// scope; `next/*` imports are not allowed here (ESLint `no-restricted-imports`, NFR-3).
export { getMailingOptions } from "./options.js";
export { sendMail, type MailContext } from "./send-mail.js";
export { validateMail, type MailValidation, type ValidMail } from "./validate-mail.js";
