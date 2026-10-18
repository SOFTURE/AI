// A plain-JS app config with mailing whose database URL is empty, as in a CI job without the app database.
import { defineSoftureConfig } from "@softure-ai/core";
import { mailing } from "@softure-ai/mailing";
import { fakeMailProvider } from "@softure-ai/mailing/testing";

export default defineSoftureConfig({
  database: { url: "" },
  locale: "en",
  timezone: "UTC",
  appOrigin: "https://app.example.com",
  modules: [mailing({ from: "Example <hello@mail.example.com>", testAddress: "operator@example.com", provider: fakeMailProvider() })],
});
