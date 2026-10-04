// Link rules (FIRE_TRACKER `rules-structure.ts`, `collectLinks`, `checkLinks`): enough internal links,
// each one to a page that exists, external links over https. Absolute links to the app's own origins
// count as internal. The network check of external links is `external-links.ts`.
import type { QualityFinding } from "../finding.js";
import { findBareUrls, findLinks } from "../text.js";
import type { RuleInput } from "./input.js";

export interface LinkSummary {
  readonly internal: readonly { readonly pathname: string; readonly line: number }[];
  readonly external: readonly { readonly url: string; readonly line: number }[];
}

/** Whether a site path (`/blog/x`, `/calculator`) leads to a page. */
export type InternalLinkResolver = (pathname: string) => boolean;

export function collectLinks({ blocks, settings }: Pick<RuleInput, "blocks" | "settings">): LinkSummary {
  const internal: { pathname: string; line: number }[] = [];
  const external: { url: string; line: number }[] = [];
  for (const block of blocks) {
    if (block.kind === "directive") continue;
    const urls = findLinks(block.text).map((link) => link.url);
    if (block.kind === "footnote") urls.push(...findBareUrls(block.text));
    for (const url of new Set(urls)) {
      const own = settings.ownOrigins.find((origin) => url === origin || url.startsWith(`${origin}/`) || url.startsWith(`${origin}?`) || url.startsWith(`${origin}#`));
      if (url.startsWith("/") || own !== undefined) {
        const rest = own === undefined ? url : url.slice(own.length);
        internal.push({ pathname: rest.split(/[?#]/)[0] || "/", line: block.line });
      } else if (/^https?:\/\//.test(url)) {
        external.push({ url, line: block.line });
      }
    }
  }
  return { internal, external };
}

export function checkLinks(input: RuleInput, links: LinkSummary, resolveInternalLink: InternalLinkResolver): QualityFinding[] {
  const findings: QualityFinding[] = [];
  const { kind } = input.article;
  const minimum = input.settings.options.limits.internalLinks[kind];
  if (links.internal.length < minimum) {
    findings.push({
      rule: "internal-links",
      severity: kind === "article" ? "error" : "warning",
      message: `${String(links.internal.length)} internal links; at least ${String(minimum)} needed (other texts, the glossary, the app's tools)`,
    });
  }
  for (const link of links.internal) {
    if (!resolveInternalLink(link.pathname)) {
      findings.push({ rule: "internal-link-target", severity: "error", message: `an internal link leads nowhere: ${link.pathname}`, line: link.line });
    }
  }
  for (const link of links.external) {
    if (link.url.startsWith("http://")) findings.push({ rule: "external-link-https", severity: "warning", message: `a link without https: ${link.url}`, line: link.line });
  }
  return findings;
}
