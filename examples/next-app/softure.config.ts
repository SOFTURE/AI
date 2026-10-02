// The app's SOFTURE configuration. `softure migrate` loads this file with Node's type stripping,
// so relative imports name their `.ts` files.
import { auth, AUTH_RATE_LIMIT_BUCKETS } from "@softure-ai/auth";
import { defineSoftureConfig } from "@softure-ai/core";
import { registerSoftureConfig } from "@softure-ai/core/next";
import { ops } from "@softure-ai/ops";
import { cloudflareIp, security } from "@softure-ai/security";
import { guestbook } from "./modules/guestbook/index.ts";

// The Postgres of compose.yaml; a local, throwaway database, so its password is not a secret.
const LOCAL_DATABASE_URL = "postgresql://postgres:postgres@localhost:5433/softure_example";

const config = defineSoftureConfig({
  database: { url: process.env.DATABASE_URL ?? LOCAL_DATABASE_URL },
  locale: process.env.APP_LOCALE === "pl" ? "pl" : "en",
  timezone: "Europe/Warsaw",
  appOrigin: process.env.APP_ORIGIN ?? "http://localhost:3000",
  modules: [
    guestbook(),
    // The e2e sends CF-Connecting-IP itself, standing in for Cloudflare (e2e/security.spec.ts).
    security({
      clientIp: cloudflareIp(),
      buckets: { "example.ping": { limit: 3, windowMinutes: 15 }, ...AUTH_RATE_LIMIT_BUCKETS },
    }),
    auth({ routes: { afterLogin: "/account" } }),
    // `detail: "checks"` lists each check in the answer, so e2e/ops.spec.ts can see the guestbook's.
    ops({ detail: "checks" }),
  ],
});

registerSoftureConfig(config);
export default config;
