// Where the blog's IndexNow submit goes: seo's key, site origin and canonical URLs. It reaches
// `@softure-ai/seo` through a dynamic import, and only when the config lists `seo()`: seo is an
// optional peer, so an app without it still runs the blog. Shared by the synchronous submit and the
// `blog.indexnow` job handler.
import { getModule, type SoftureConfig } from "@softure-ai/core";

const SEO_MODULE_ID = "seo";

type SeoServer = typeof import("@softure-ai/seo/server");

/** What seo's `submitToIndexNow` answers. */
export type SeoIndexNowResult = Awaited<ReturnType<SeoServer["submitToIndexNow"]>>;

export interface IndexNowSendOptions {
  /** Sends the request only when `true`; otherwise a dry run. */
  readonly commit: boolean;
  readonly fetchImpl?: typeof fetch;
}

export type IndexNowTarget =
  /** seo is not listed, or it has no IndexNow key: nothing can be sent. */
  | { readonly kind: "not_configured"; readonly reason: string }
  | {
      readonly kind: "ready";
      /** Canonical URLs (seo's host and trailing-slash rule), so the engines learn the address the pages declare. */
      readonly toUrls: (paths: readonly string[]) => string[];
      readonly send: (urls: readonly string[], options: IndexNowSendOptions) => Promise<SeoIndexNowResult>;
    };

/** Resolves seo's IndexNow settings for the config; never throws for a missing seo or key. */
export async function loadIndexNowTarget(config: SoftureConfig): Promise<IndexNowTarget> {
  const seoModule = getModule(config, SEO_MODULE_ID);
  if (seoModule === undefined) return { kind: "not_configured", reason: "the seo module is not enabled; add seo({ indexNow: { key } }) to modules" };

  const [{ buildCanonicalUrl, resolveSeoSettings }, { submitToIndexNow }] = await Promise.all([import("@softure-ai/seo"), import("@softure-ai/seo/server")]);
  // The seo module factory parsed its options and declares both routes.
  const settings = resolveSeoSettings(seoModule.options as Parameters<typeof resolveSeoSettings>[0], {
    appOrigin: config.appOrigin,
    routes: seoModule.routes as unknown as Parameters<typeof resolveSeoSettings>[1]["routes"],
  });
  const key = settings.indexNowKey;
  if (key === null) return { kind: "not_configured", reason: "seo has no IndexNow key; set seo({ indexNow: { key } })" };

  return {
    kind: "ready",
    toUrls: (paths) => paths.map((path) => buildCanonicalUrl(path, settings)),
    send: (urls, options) =>
      submitToIndexNow(urls, {
        key,
        siteOrigin: settings.siteOrigin,
        keyPath: settings.routes.indexNowKey,
        commit: options.commit,
        ...(options.fetchImpl === undefined ? {} : { fetchImpl: options.fetchImpl }),
      }),
  };
}
