// Settings for the builders, made the way the app makes them: through `seo({ ... })`.
import { resolveSeoSettings, seo, type SeoSettings } from "@softure-ai/seo";

export const APP_ORIGIN = "https://app.example.com";

export function createSettings(options: Parameters<typeof seo>[0] = {}, appOrigin = APP_ORIGIN): SeoSettings {
  const module = seo(options);
  return resolveSeoSettings(module.options, { appOrigin, routes: module.routes });
}
