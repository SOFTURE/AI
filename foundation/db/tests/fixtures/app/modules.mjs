// The fixture modules in plain JS, for the configs the `softure` bin imports.
import { defineModule } from "@softure-ai/core";

const messages = { en: { title: "Title" }, pl: { title: "PL" } };
const base = { version: "0.1.0", tables: [], env: [], switches: [], routes: {}, mount: [], privacy: { exports: false, deletes: false } };

export const notes = defineModule({
  manifest: { ...base, id: "notes", dependsOn: {}, dbSchema: "notes" },
  messages,
  migrations: { dir: new URL("../notes/migrations/", import.meta.url) },
});

export const tags = defineModule({
  manifest: { ...base, id: "tags", dependsOn: { notes: "^0.1.0" }, dbSchema: "tags" },
  messages,
  migrations: { dir: new URL("../tags/migrations/", import.meta.url) },
});
