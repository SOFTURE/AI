// A Worker that loads a SOFTURE config enabling a module at its start, as a jobs Worker's scheduled handler does before
// any request (e2e/module-config-on-workerd.spec.ts). wrangler bundles it into one ES module, and workerd leaves that
// module's `import.meta.url` undefined, so every module package's migrations folder must still resolve.
import { defineSoftureConfig } from "@softure-ai/core";
import { cloudflareIp, security } from "@softure-ai/security";

const config = defineSoftureConfig({
  platform: { host: "cloudflare" },
  locale: "en",
  timezone: "UTC",
  appOrigin: "http://localhost:3000",
  // Never connected: the config only names it, as the module's schema requires.
  database: { url: "postgresql://localhost:5432/unused" },
  modules: [security({ clientIp: cloudflareIp(), buckets: { login: { limit: 5, windowMinutes: 15 } } })],
});

export default {
  fetch(): Response {
    return Response.json({
      platform: config.platform,
      modules: config.modules.map((module) => ({ id: module.id, migrations: module.migrations?.dir.href ?? null })),
    });
  },
};
