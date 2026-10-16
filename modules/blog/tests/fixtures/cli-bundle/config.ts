// The config of an app that uses the blog without @softure-ai/jobs.
import { defineSoftureConfig } from "@softure-ai/core";
import { blog } from "@softure-ai/blog";

export default defineSoftureConfig({
  database: { url: "pglite://" },
  locale: "en",
  timezone: "UTC",
  appOrigin: "https://app.example.com",
  modules: [blog({ quality: false })],
});
