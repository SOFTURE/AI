// The jobs adapter of @softure-ai/waitlist: the double opt-in confirmation mail sent by a background
// job with retry instead of after the response. `@softure-ai/jobs` is an optional peer dependency;
// only apps that import this entry need it.
export { CONFIRMATION_MAIL_QUEUE, confirmationMailJobHandler, enqueueConfirmationMail, waitlistJobHandlers } from "./confirmation-mail-job.js";
