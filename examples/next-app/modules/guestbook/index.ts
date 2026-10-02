// A minimal module owned by the example app: one schema, one table, one migration. It stands in for
// a published module package, so the e2e covers the migrator and a module's tables end to end.
import { defineModule } from "@softure-ai/core";

// Turbopack resolves a literal `new URL("./x/", import.meta.url)` at build time and fails on a folder
// ("Can't resolve './migrations/'"); it does not follow the URL through String(). Only
// `softure migrate` reads the folder, under plain Node (context/backlog/next-integration.md).
const MODULE_URL = String(import.meta.url);

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
  migrations: { dir: new URL("./migrations/", MODULE_URL) },
});
