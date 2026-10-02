export const en = {
  meta: {
    title: "SOFTURE AI example",
    description: "A Next.js app built from @softure-ai/core, db and ui.",
  },
  home: {
    title: "SOFTURE AI example app",
    lead: "Core, db and ui installed as packed packages, the way an app gets them from npm.",
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
  errors: {
    "guestbook.message_invalid": "Write between 1 and 200 characters.",
    "core.database_failed": "The database did not answer. Try again.",
    "core.unexpected": "Something went wrong. Try again.",
  },
};

export type AppMessages = typeof en;
