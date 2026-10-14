// The jobs adapter of @softure-ai/auth: password reset mails sent by a background job with retry
// instead of in the request. `@softure-ai/jobs` is an optional peer dependency; only apps that
// import this entry need it.
export { authJobHandlers, enqueuePasswordReset, PASSWORD_RESET_QUEUE, passwordResetJobHandler } from "./password-reset-job.js";
