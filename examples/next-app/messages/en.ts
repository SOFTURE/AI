export const en = {
  meta: {
    title: "SOFTURE AI example",
    description: "A Next.js app built from @softure-ai/core, db and ui.",
  },
  home: {
    title: "SOFTURE AI example app",
    lead: "Core, db and ui installed as packed packages, the way an app gets them from npm.",
    welcomeBanner: "Welcome! This banner is on because an admin turned its switch on.",
  },
  guestbook: {
    title: "Guestbook",
    subtitle: "Entries live in the guestbook schema, created by its migration.",
    add: "Add entry",
    modalTitle: "New entry",
    messageLabel: "Message",
    submit: "Save entry",
    saved: "Entry saved",
    empty: "No entries yet",
    emptyBody: "Add the first one.",
  },
  migrations: {
    title: "Applied migrations",
    subtitle: "Rows of the softure.migrations ledger.",
    empty: "No migrations applied. Run npm run migrate.",
  },
  account: {
    title: "Your account",
    lead: "Only signed-in users see this page.",
    changePassword: "Change password",
    admin: "Admin panel",
    assistant: "AI assistant access",
    testMail: "Send a test mail",
    privacy: "Your data",
  },
  admin: {
    title: "Admin panel",
    lead: "Only admins see this page; everyone else gets not found.",
    messageLabel: "Announcement",
    submit: "Post",
    saved: "Announcement posted",
  },
  mail: {
    title: "Test mail",
    lead: "Sends a mail to your own address through @softure-ai/mailing.",
    subjectLabel: "Subject",
    defaultSubject: "Hello from the SOFTURE example",
    body: "This is a test mail from the SOFTURE example app.",
    submit: "Send me a test mail",
    sent: "Test mail sent to your address",
    newsletterLabel: "Send it as a newsletter",
    newsletterHint: "List mail: it gets an unsubscribe link and is not sent once you unsubscribe.",
  },
  switches: {
    welcomeBanner: {
      label: "Welcome banner",
      description: "Shows a welcome line on the home page.",
    },
  },
  mcp: {
    whoami: "Tells the assistant which account the token belongs to.",
    listEntries: "Reads the newest guestbook entries.",
    signGuestbook: "Adds an entry to the guestbook.",
  },
  errors: {
    "guestbook.message_invalid": "Write between 1 and {max} characters.",
    "auth.forbidden": "You do not have access to this.",
    "auth.unauthenticated": "Your session has ended. Sign in again.",
    "core.database_failed": "The database did not answer. Try again.",
    "mailing.invalid_input": "This message cannot be sent. Check the subject and try again.",
    "mailing.rejected": "The mail service refused this message.",
    "mailing.unavailable": "The mail service is not answering. Try again in a moment.",
    "mailing.suppressed": "You unsubscribed from newsletters, so nothing was sent.",
    "core.unexpected": "Something went wrong. Try again.",
  },
};

export type AppMessages = typeof en;
