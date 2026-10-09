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
import { getBlogSlotClass } from "./class-names.js";
import type { BlogPageContext } from "./page-context.js";

/** What the app's `renderCard` receives for one listing card. */
export interface BlogCardInput {
  readonly article: BlogArticle;
  /** The article's path. */
  readonly href: string;
  /** The pillar of its cluster, shown before the grid. */
  readonly isLead: boolean;
  readonly context: BlogPageContext;
}

/** The app's card in place of the package's `<article>`; the list item around it stays the package's. */
export type BlogCardRenderer = (card: BlogCardInput) => ReactNode;

export interface BlogListingViewProps {
  readonly context: BlogPageContext;
  readonly groups: readonly ClusterGroup<BlogArticle>[];
  /** Published glossary terms; the glossary link shows when there is at least one. */
  readonly termCount: number;
  readonly timezone: string;
  /** The app's call to action under the cards. */
  readonly cta?: ReactNode;
  readonly renderCard?: BlogCardRenderer;
}

function CardMeta({ article, context, timezone }: { readonly article: BlogArticle; readonly context: BlogPageContext; readonly timezone: string }) {
  const copy = context.messages.pages;
  const dates = getArticleDates(article, timezone);
  const shownDay = dates.updated ?? dates.published;
  const date = formatDay(shownDay, context.locale);
  return (
    <p className={getBlogSlotClass(context)("cardMeta")}>
      <time dateTime={shownDay}>{dates.updated === null ? date : formatMessage(copy.updatedOn, { date })}</time>
      <span aria-hidden="true">{" · "}</span>
      <span>{formatMessage(copy.readingTime, { minutes: getReadingMinutes(article.bodyMarkdown) })}</span>
    </p>
  );
}

interface ArticleCardProps {
  readonly article: BlogArticle;
  readonly context: BlogPageContext;
  readonly timezone: string;
  readonly isLead: boolean;
  readonly renderCard: BlogCardRenderer | undefined;
}

function ArticleCard({ article, context, timezone, isLead, renderCard }: ArticleCardProps) {
  const href = getArticlePath(context.routes, article.slug);
  if (renderCard !== undefined) return renderCard({ article, href, isLead, context });
  const cls = getBlogSlotClass(context);
  return (
    <article className={isLead ? cls("card", "cardLead") : cls("card")} data-slug={article.slug}>
      {isLead ? <p className={cls("badge")}>{context.messages.pages.startHere}</p> : null}
      <h3 className={cls("cardTitle")}>
        <a className={cls("cardLink")} href={href}>
          {article.title}
        </a>
      </h3>
      <p className={cls("cardDescription")}>{article.description}</p>
      <CardMeta article={article} context={context} timezone={timezone} />
    </article>
  );
}

export function BlogListingView({ context, groups, termCount, timezone, cta, renderCard }: BlogListingViewProps) {
  const copy = context.messages.pages;
  const cls = getBlogSlotClass(context);
  return (
    <BlogLayout context={context} title={copy.blogTitle} lead={copy.blogDescription}>
      {groups.length === 0 ? (
        <p className={cls("empty")}>{copy.empty}</p>
      ) : (
        <div className={cls("groups")}>
          {groups.map((group) => {
            const id = group.cluster === null ? undefined : getClusterAnchor(group.cluster, context.clusterAnchorPrefix);
            const headingId = `${id ?? getClusterAnchor("other", context.clusterAnchorPrefix)}-heading`;
            return (
              <section key={group.cluster ?? ""} id={id} aria-labelledby={headingId} className={cls("group")}>
                <h2 id={headingId} className={cls("groupTitle")}>
                  {group.label}
                </h2>
                {group.lead === null ? null : <ArticleCard article={group.lead} context={context} timezone={timezone} isLead renderCard={renderCard} />}
                {group.rest.length === 0 ? null : (
                  <ul className={cls("cards")}>
                    {group.rest.map((article) => (
                      <li key={article.id}>
                        <ArticleCard article={article} context={context} timezone={timezone} isLead={false} renderCard={renderCard} />
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            );
          })}
        </div>
      )}
      {cta === undefined ? null : <div className={cls("slot")}>{cta}</div>}
      {termCount > 0 ? (
        <p className={cls("glossaryTeaser")}>
          <a href={context.routes.glossary}>{copy.glossaryLink}</a>
          {": "}
          {copy.glossaryTeaser}
        </p>
      ) : null}
      <BlogFooterNote context={context} />
    </BlogLayout>
  );
}
