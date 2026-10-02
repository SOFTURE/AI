// A plain-JS app config, as the `softure` bin loads it; in memory unless the environment says otherwise.
import { defineSoftureConfig } from "@softure-ai/core";
import { notes, tags } from "./modules.mjs";

export default defineSoftureConfig({
  database: { url: process.env.SOFTURE_FIXTURE_DATABASE_URL ?? "pglite://" },
  locale: "en",
  timezone: "Europe/Warsaw",
  appOrigin: "http://localhost:3000",
  modules: [tags(), notes()],
});
