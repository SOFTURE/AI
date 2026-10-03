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
  waitlist: {
    title: "Waitlist",
    subtitle: "Sign-ups of @softure-ai/waitlist, with consents recorded in privacy.consents.",
    launch: "Tell me when the example opens (privacy policy applies).",
    newsletter: "Send me the occasional newsletter.",
  },
  legal: {
    footer: {
      terms: "Terms of service",
      privacy: "Privacy policy",
      note: "SOFTURE AI example app: a demo, not a real service.",
    },
    terms: {
      title: "Terms of service",
      intro: "These terms apply to the SOFTURE AI example app, a demo of the SOFTURE modules.",
      sections: [
        { id: "service", title: "1. The service", body: "The app shows how the SOFTURE modules work together. It is provided for testing only." },
        { id: "account", title: "2. Your account", body: "Keep your password to yourself. You can delete your account at any time from Your data." },
        { id: "content", title: "3. Your content", body: "Guestbook entries are public. Do not post anything you do not want others to read." },
      ],
      changes: [
        { version: "2026-10-01", date: "2026-10-01", summary: "Account deletion added to section 2." },
        { version: "2026-09-01", date: "2026-09-01", summary: "First version." },
      ],
    },
    privacy: {
      title: "Privacy policy",
      intro: "This policy says what the example app stores about you and what you can do about it.",
      sections: [
        { id: "data", title: "1. What we store", body: "Your email address, a hash of your password, your sessions and the consents you gave." },
        { id: "consents", title: "2. Your consents", body: "When you register, we record that you accepted these documents, with their versions and the time." },
        { id: "rights", title: "3. Your rights", body: "Download your data or delete your account from Your data. Deleting the account removes your consents too." },
      ],
      changes: [{ version: "2026-10-01", date: "2026-10-01", summary: "First version." }],
    },
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
