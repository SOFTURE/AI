// A minimal module owned by the example app: one schema, one table, one migration. It stands in for
// a published module package, so the e2e covers the migrator and a module's tables end to end.
import { defineModule, resolveMigrationsDir } from "@softure-ai/core";

export const guestbook = defineModule({
  manifest: {
    id: "guestbook",
    version: "0.1.0",
    dependsOn: {},
    dbSchema: "guestbook",
    tables: ["entries"],
    env: [],
    switches: [],
    routes: {},
    mount: [],
    privacy: { exports: false, deletes: false },
  },
  // The module has no copy of its own: the app's dictionaries in messages/ hold every text.
  messages: { en: {}, pl: {} },
  migrations: { dir: resolveMigrationsDir(import.meta.url, "./migrations/") },
});
