// A plain-JS app config with mailing, as the `softure-mail` bin loads it.
import { defineSoftureConfig } from "@softure-ai/core";
import { mailing } from "@softure-ai/mailing";
import { fakeMailProvider } from "@softure-ai/mailing/testing";

export default defineSoftureConfig({
  database: { url: "pglite://" },
  locale: "en",
  timezone: "UTC",
  appOrigin: "https://app.example.com",
  modules: [mailing({ from: "Example <hello@mail.example.com>", provider: fakeMailProvider() })],
});
