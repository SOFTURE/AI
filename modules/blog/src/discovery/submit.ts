// The IndexNow submit after a publish: the CLI calls it after `softure-blog publish`, and an app with
// its own publishing path calls it after `runBlogPublish`. It reaches `@softure-ai/seo` through a
// dynamic import, and only when the config lists `seo()`: seo is an optional peer, so an app without
// it still runs the blog.
import { getModule, type SoftureConfig } from "@softure-ai/core";
import { getBlogRoutes } from "../server/options.js";
import { getIndexNowPaths, type IndexNowChange } from "./indexnow.js";

const SEO_MODULE_ID = "seo";

export type BlogIndexNowOutcome =
  /** seo is not listed, or it has no IndexNow key: nothing is sent. */
  | { readonly kind: "not_configured"; readonly reason: string }
  /** The run changed no public address. */
  | { readonly kind: "skipped" }
  /** No commit: the URLs a commit would submit, and no request. */
  | { readonly kind: "dry_run"; readonly endpoint: string; readonly urls: readonly string[] }
  | { readonly kind: "submitted"; readonly status: number; readonly count: number }
  | { readonly kind: "failed"; readonly code: string; readonly reason: string };

export interface BlogIndexNowSubmit {
  /** The changed paths (`getIndexNowPaths`), also when nothing is sent. */
  readonly paths: readonly string[];
  readonly outcome: BlogIndexNowOutcome;
}

export interface SubmitBlogChangesOptions {
  /** Sends the request only when `true`, i.e. after a committed run; otherwise a dry run. */
  readonly commit?: boolean;
  readonly fetchImpl?: typeof fetch;
}

/**
 * Submits the addresses a publish run changed through seo's IndexNow, on seo's site origin. Inside
 * Next, call `revalidateTag("softure-blog")` first, so a crawler that comes at once sees the new text.
 * Never throws for an expected failure: a submit is an extra after a publish and must not undo it.
 */
export async function submitBlogChanges(config: SoftureConfig, changes: readonly IndexNowChange[], options: SubmitBlogChangesOptions = {}): Promise<BlogIndexNowSubmit> {
  const paths = getIndexNowPaths(changes, getBlogRoutes(config));
  const seoModule = getModule(config, SEO_MODULE_ID);
  if (seoModule === undefined) return { paths, outcome: { kind: "not_configured", reason: "the seo module is not enabled; add seo({ indexNow: { key } }) to modules" } };

  const [{ buildCanonicalUrl, resolveSeoSettings }, { submitToIndexNow }] = await Promise.all([import("@softure-ai/seo"), import("@softure-ai/seo/server")]);
  // The seo module factory parsed its options and declares both routes.
  const settings = resolveSeoSettings(seoModule.options as Parameters<typeof resolveSeoSettings>[0], {
    appOrigin: config.appOrigin,
    routes: seoModule.routes as unknown as Parameters<typeof resolveSeoSettings>[1]["routes"],
  });
  if (settings.indexNowKey === null) return { paths, outcome: { kind: "not_configured", reason: "seo has no IndexNow key; set seo({ indexNow: { key } })" } };

  // Canonical URLs (seo's host and trailing-slash rule), so the engines learn the address the pages declare.
  const urls = paths.map((path) => buildCanonicalUrl(path, settings));
  const result = await submitToIndexNow(urls, {
    key: settings.indexNowKey,
    siteOrigin: settings.siteOrigin,
    keyPath: settings.routes.indexNowKey,
    commit: options.commit === true,
    ...(options.fetchImpl === undefined ? {} : { fetchImpl: options.fetchImpl }),
  });
  switch (result.kind) {
    case "dry_run":
      return { paths, outcome: { kind: "dry_run", endpoint: result.endpoint, urls: result.body.urlList } };
    case "failed":
      return { paths, outcome: { kind: "failed", code: result.code, reason: result.reason } };
    default:
      return { paths, outcome: result };
  }
}
