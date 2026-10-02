// Exports the config under the name `config` instead of as the default export.
import { defineSoftureConfig } from "@softure-ai/core";
import { notes } from "./modules.mjs";

export const config = defineSoftureConfig({
  database: { url: process.env.SOFTURE_FIXTURE_DATABASE_URL ?? "pglite://" },
  locale: "en",
  timezone: "Europe/Warsaw",
  appOrigin: "http://localhost:3000",
  modules: [notes()],
});
