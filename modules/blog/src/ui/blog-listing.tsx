// The listing: articles as cards in groups by cluster, the pillar of a cluster as a lead card before
// the grid. A whole card is one link (its title's anchor stretches over the card in CSS), so a screen
// reader hears one link named after the text and a finger can hit anywhere.
import { formatMessage } from "@softure-ai/core";
import type { ReactNode } from "react";
import type { BlogArticle } from "../contract.js";
import { formatDay, getArticleDates } from "../pages/dates.js";
import { getClusterAnchor, type ClusterGroup } from "../pages/listing.js";
import { getArticlePath } from "../pages/paths.js";
import { getReadingMinutes } from "../render/reading-time.js";
import { BlogFooterNote, BlogLayout } from "./blog-layout.js";
import type { BlogPageContext } from "./page-context.js";

export interface BlogListingViewProps {
  readonly context: BlogPageContext;
  readonly groups: readonly ClusterGroup<BlogArticle>[];
  /** Published glossary terms; the glossary link shows when there is at least one. */
  readonly termCount: number;
  readonly timezone: string;
  /** The app's call to action under the cards. */
  readonly cta?: ReactNode;
}

function CardMeta({ article, context, timezone }: { readonly article: BlogArticle; readonly context: BlogPageContext; readonly timezone: string }) {
  const copy = context.messages.pages;
  const dates = getArticleDates(article, timezone);
  const shownDay = dates.updated ?? dates.published;
  const date = formatDay(shownDay, context.locale);
  return (
    <p className="blog-card-meta">
      <time dateTime={shownDay}>{dates.updated === null ? date : formatMessage(copy.updatedOn, { date })}</time>
      <span aria-hidden="true">{" · "}</span>
      <span>{formatMessage(copy.readingTime, { minutes: getReadingMinutes(article.bodyMarkdown) })}</span>
    </p>
  );
}

function ArticleCard({ article, context, timezone, isLead }: { readonly article: BlogArticle; readonly context: BlogPageContext; readonly timezone: string; readonly isLead: boolean }) {
  return (
    <article className={isLead ? "blog-card blog-card-lead" : "blog-card"} data-slug={article.slug}>
      {isLead ? <p className="blog-badge">{context.messages.pages.startHere}</p> : null}
      <h3 className="blog-card-title">
        <a className="blog-card-link" href={getArticlePath(context.routes, article.slug)}>
          {article.title}
        </a>
      </h3>
      <p className="blog-card-description">{article.description}</p>
      <CardMeta article={article} context={context} timezone={timezone} />
    </article>
  );
}

export function BlogListingView({ context, groups, termCount, timezone, cta }: BlogListingViewProps) {
  const copy = context.messages.pages;
  return (
    <BlogLayout context={context} title={copy.blogTitle} lead={copy.blogDescription}>
      {groups.length === 0 ? (
        <p className="blog-empty">{copy.empty}</p>
      ) : (
        <div className="blog-groups">
          {groups.map((group) => {
            const id = group.cluster === null ? undefined : getClusterAnchor(group.cluster, context.clusterAnchorPrefix);
            const headingId = `${id ?? getClusterAnchor("other", context.clusterAnchorPrefix)}-heading`;
            return (
              <section key={group.cluster ?? ""} id={id} aria-labelledby={headingId} className="blog-group">
                <h2 id={headingId} className="blog-group-title">
                  {group.label}
                </h2>
                {group.lead === null ? null : <ArticleCard article={group.lead} context={context} timezone={timezone} isLead />}
                {group.rest.length === 0 ? null : (
                  <ul className="blog-cards">
                    {group.rest.map((article) => (
                      <li key={article.id}>
                        <ArticleCard article={article} context={context} timezone={timezone} isLead={false} />
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            );
          })}
        </div>
      )}
      {cta === undefined ? null : <div className="blog-slot">{cta}</div>}
      {termCount > 0 ? (
        <p className="blog-glossary-teaser">
          <a href={context.routes.glossary}>{copy.glossaryLink}</a>
          {": "}
          {copy.glossaryTeaser}
        </p>
      ) : null}
      <BlogFooterNote context={context} />
    </BlogLayout>
  );
}
