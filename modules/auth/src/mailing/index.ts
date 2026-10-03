// The mailing adapter of @softure-ai/auth: password reset mails through `@softure-ai/mailing`
// (an optional peer dependency; only apps that import this entry need it).
export { mailingResetSender, renderPasswordResetMail, type PasswordResetMail, type PasswordResetMailInput } from "./reset-mail.js";
