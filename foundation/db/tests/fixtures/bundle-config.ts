// The app config of the container bundle test. Bundled, the modules' own folders are wrong
// (import.meta.url is the bundle), so the bundled runner reads exported migrations instead.
import { defineSoftureConfig } from "@softure-ai/core";
import { createNotesModule, createTagsModule } from "./modules.js";

const config = defineSoftureConfig({
  database: { url: process.env.SOFTURE_FIXTURE_DATABASE_URL ?? "pglite://" },
  locale: "en",
  timezone: "Europe/Warsaw",
  appOrigin: "http://localhost:3000",
  modules: [createTagsModule(), createNotesModule()],
});

export default config;
