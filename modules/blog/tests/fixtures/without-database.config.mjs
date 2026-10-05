// A plain-JS app config with the blog whose database URL comes from a variable nobody sets, as the weekly
// link check in CI sees it. The tests copy it to a fresh folder next to this one per load: Node keeps a
// module's first evaluation, failed or not.
import { defineSoftureConfig } from "@softure-ai/core";
import { blog } from "@softure-ai/blog";

export default defineSoftureConfig({
  database: { url: process.env.SOFTURE_FIXTURE_UNSET_DATABASE_URL ?? "" },
  locale: "en",
  timezone: "UTC",
  appOrigin: "https://app.example.com",
  modules: [blog({ contentDir: "../content" })],
});
