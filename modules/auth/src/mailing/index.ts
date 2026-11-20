// The mailing adapter of @softure-ai/auth: password reset and invitation mails through `@softure-ai/mailing`
// (an optional peer dependency; only apps that import this entry need it).
export { mailingInvitationSender, renderInvitationMail, type InvitationMail, type InvitationMailInput } from "./invitation-mail.js";
export { mailingResetSender, renderPasswordResetMail, type PasswordResetMail, type PasswordResetMailInput } from "./reset-mail.js";
