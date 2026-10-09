// The mailing adapter of @softure-ai/billing: reminder mail before and after access ends, through
// `@softure-ai/mailing` (an optional peer dependency; only apps that import this entry need it).
export {
  DEFAULT_REMINDER_PAUSE_MS,
  renderAccessReminderMail,
  sendAccessReminders,
  type AccessReminderMail,
  type AccessReminderMailContext,
  type AccessReminderMailInput,
  type AccessReminderSummary,
  type SendAccessRemindersOptions,
} from "./reminder-mail.js";
