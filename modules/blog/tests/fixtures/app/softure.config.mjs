// A plain-JS app config with the blog, as the `softure-blog` bin loads it.
import { defineSoftureConfig } from "@softure-ai/core";
import { blog } from "@softure-ai/blog";

export default defineSoftureConfig({
  database: { url: "pglite://" },
  locale: "en",
  timezone: "UTC",
  appOrigin: "https://app.example.com",
  modules: [blog({ contentDir: "../content" })],
});
