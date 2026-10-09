// The article page, answer first: crumbs, title, description and dates; then the "in short" box, the
// contents (from two level-2 headings up), the body, questions and answers, sources, the signature
// and the disclaimer; then the app's slots. Everything is server HTML: a crawler without JavaScript
// gets the whole text.
import { formatMessage } from "@softure-ai/core";
import type { ReactNode } from "react";
import type { BlogArticle, BlogSource } from "../contract.js";
import { formatDay, type ArticleDates } from "../pages/dates.js";
import type { Crumb } from "../pages/listing.js";
import { getArticlePath } from "../pages/paths.js";
import type { ArticleHeading, ArticleSegment } from "../render/render-article.js";
import { BlogFooterNote, BlogLayout, JsonLdScript } from "./blog-layout.js";
import { getBlogSlotClass } from "./class-names.js";
import type { BlogPageContext } from "./page-context.js";

/** The class slots of a part a view renders; the parts work without them too. */
type SlotContext = Pick<BlogPageContext, "classNames" | "unstyled">;

export interface RenderedBody {
  readonly segments: readonly ArticleSegment<ReactNode>[];
  readonly headings: readonly ArticleHeading[];
  readonly readingMinutes: number;
}

export interface BlogArticleViewProps {
  readonly context: BlogPageContext;
  readonly article: BlogArticle;
  readonly dates: ArticleDates;
  readonly body: RenderedBody;
  readonly crumbs: readonly Crumb[];
  /** From `serializeJsonLd(getArticleJsonLd(…))`. */
  readonly jsonLd: string;
  /** The app's call to action, right after the text. */
  readonly cta?: ReactNode;
  /** The app's block under the article, e.g. `<Waitlist placement="blog" />`. */
  readonly afterArticle?: ReactNode;
  /** "Read next" (`getRelatedArticles`); none or empty: no section. */
  readonly related?: readonly Pick<BlogArticle, "id" | "slug" | "title" | "description">[];
}

/** The body in order: HTML segments from the renderer, node segments (the app's block plugins) as they are. */
export function ArticleBody({ segments, context }: { readonly segments: readonly ArticleSegment<ReactNode>[]; readonly context?: SlotContext }) {
  const cls = getBlogSlotClass(context ?? {});
  return (
    <div className={cls("body")}>
      {segments.map((segment, index) =>
        segment.kind === "html" ? (
          // The renderer's output is the security boundary: raw HTML escaped, unsafe links dropped.
          <div key={index} className={cls("segment")} dangerouslySetInnerHTML={{ __html: segment.html }} />
        ) : (
          <div key={index} className={cls("segment")} data-block={segment.type}>
            {segment.node}
          </div>
        ),
      )}
    </div>
  );
}

function DateItem({ label, day, context }: { readonly label: string; readonly day: string; readonly context: BlogPageContext }) {
  return (
    <div>
      <dt>{label}</dt>
      <dd>
        <time dateTime={day}>{formatDay(day, context.locale)}</time>
      </dd>
    </div>
  );
}

export function ArticleDatesList({ dates, readingMinutes, context }: { readonly dates: ArticleDates; readonly readingMinutes?: number; readonly context: BlogPageContext }) {
  const copy = context.messages.pages;
  const cls = getBlogSlotClass(context);
  return (
    <dl className={cls("dates")}>
      <DateItem label={copy.published} day={dates.published} context={context} />
      {dates.updated === null ? null : <DateItem label={copy.updated} day={dates.updated} context={context} />}
      <DateItem label={copy.currentAsOf} day={dates.currentAsOf} context={context} />
      {readingMinutes === undefined ? null : (
        <div>
          <dt className={cls("visuallyHidden")}>{copy.readingTimeLabel}</dt>
          <dd>{formatMessage(copy.readingTime, { minutes: readingMinutes })}</dd>
        </div>
      )}
    </dl>
  );
}

export function SourceList({ sources, heading, context }: { readonly sources: readonly BlogSource[]; readonly heading: string; readonly context?: SlotContext }) {
  if (sources.length === 0) return null;
  return (
    <section aria-labelledby="blog-sources" className={getBlogSlotClass(context ?? {})("section", "sources")}>
      <h2 id="blog-sources">{heading}</h2>
      <ul>
        {sources.map((source) => (
          <li key={source.url}>
            <a href={source.url} rel="noopener noreferrer" target="_blank">
              {source.name}
            </a>
          </li>
        ))}
      </ul>
    </section>
  );
}

/** The texts "read next" lists: any text with an id, a slug, a title and a description. */
export interface RelatedListProps {
  readonly articles: readonly Pick<BlogArticle, "id" | "slug" | "title" | "description">[];
  readonly context: BlogPageContext;
}

/**
 * "Read next": texts of the same cluster, then of others, chosen without manual lists. After the app's
 * call to action: the text has just made its point, so the app's next step comes first, this second.
 * An app with its own article view places it itself (slots `related`, `relatedTitle`, `relatedList`,
 * `relatedItem`).
 */
export function RelatedList({ articles, context }: RelatedListProps) {
  if (articles.length === 0) return null;
  const cls = getBlogSlotClass(context);
  return (
    <section aria-labelledby="blog-related" className={cls("section", "related")}>
      <h2 id="blog-related" className={cls("relatedTitle")}>
        {context.messages.pages.readNext}
      </h2>
      <ul className={cls("relatedList")}>
        {articles.map((article) => (
          <li key={article.id} className={cls("relatedItem")}>
            <h3>
              <a href={getArticlePath(context.routes, article.slug)}>{article.title}</a>
            </h3>
            <p>{article.description}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}

function Contents({ headings, label, context }: { readonly headings: readonly ArticleHeading[]; readonly label: string; readonly context: SlotContext }) {
  const sections = headings.filter((heading) => heading.level === 2);
  if (sections.length < 2) return null;
  const cls = getBlogSlotClass(context);
  return (
    <nav aria-labelledby="blog-contents" className={cls("contents")}>
      <p id="blog-contents" className={cls("contentsTitle")}>
        {label}
      </p>
      <ol>
        {sections.map((heading) => (
          <li key={heading.id}>
            <a href={`#${heading.id}`}>{heading.text}</a>
          </li>
        ))}
      </ol>
    </nav>
  );
}

export function BlogArticleView({ context, article, dates, body, crumbs, jsonLd, cta, afterArticle, related = [] }: BlogArticleViewProps) {
  const copy = context.messages.pages;
  const cls = getBlogSlotClass(context);
  return (
    <BlogLayout
      context={context}
      title={article.title}
      lead={article.description}
      crumbs={crumbs}
      meta={<ArticleDatesList dates={dates} readingMinutes={body.readingMinutes} context={context} />}
    >
      <JsonLdScript json={jsonLd} />
      <div className={cls("articleLayout")}>
        <Contents headings={body.headings} label={copy.contents} context={context} />
        <article className={cls("article")}>
          {article.summary === null ? null : (
            <aside aria-labelledby="blog-summary" className={cls("summary")}>
              <h2 id="blog-summary">{copy.summary}</h2>
              <p>{article.summary}</p>
            </aside>
          )}
          <ArticleBody segments={body.segments} context={context} />
          {article.faq.length === 0 ? null : (
            <section aria-labelledby="blog-faq" className={cls("section", "faq")}>
              <h2 id="blog-faq">{copy.faq}</h2>
              <dl>
                {article.faq.map((entry) => (
                  <div key={entry.question}>
                    <dt>{entry.question}</dt>
                    <dd>{entry.answer}</dd>
                  </div>
                ))}
              </dl>
            </section>
          )}
          <SourceList sources={article.sources} heading={copy.sources} context={context} />
          <BlogFooterNote context={context} />
        </article>
      </div>
      {cta === undefined ? null : <div className={cls("slot")}>{cta}</div>}
      <RelatedList articles={related} context={context} />
      {afterArticle === undefined ? null : <div className={cls("slot")}>{afterArticle}</div>}
    </BlogLayout>
  );
}
