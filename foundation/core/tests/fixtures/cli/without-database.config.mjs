// An app config whose module has a database schema and whose URL comes from a variable nobody sets,
// as a CI job that only checks files sees it. The tests copy it to a fresh folder per load: Node keeps
// a module's first evaluation, failed or not.
import { defineModule, defineSoftureConfig } from "@softure-ai/core";

const notes = defineModule({
  manifest: {
    id: "notes",
    version: "0.1.0",
    dependsOn: {},
    dbSchema: "notes",
    tables: [],
    env: [],
    switches: [],
    routes: {},
    mount: [],
    privacy: { exports: false, deletes: false },
  },
  messages: { en: {}, pl: {} },
  migrations: { dir: new URL("./migrations/", import.meta.url) },
});

export default defineSoftureConfig({
  database: { url: process.env.SOFTURE_FIXTURE_UNSET_DATABASE_URL ?? "" },
  locale: "en",
  timezone: "UTC",
  appOrigin: "https://app.example.com",
  modules: [notes()],
});
