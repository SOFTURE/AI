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
import type { BlogPageContext } from "./page-context.js";

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
export function ArticleBody({ segments }: { readonly segments: readonly ArticleSegment<ReactNode>[] }) {
  return (
    <div className="blog-body">
      {segments.map((segment, index) =>
        segment.kind === "html" ? (
          // The renderer's output is the security boundary: raw HTML escaped, unsafe links dropped.
          <div key={index} className="blog-segment" dangerouslySetInnerHTML={{ __html: segment.html }} />
        ) : (
          <div key={index} className="blog-segment" data-block={segment.type}>
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
  return (
    <dl className="blog-dates">
      <DateItem label={copy.published} day={dates.published} context={context} />
      {dates.updated === null ? null : <DateItem label={copy.updated} day={dates.updated} context={context} />}
      <DateItem label={copy.currentAsOf} day={dates.currentAsOf} context={context} />
      {readingMinutes === undefined ? null : (
        <div>
          <dt className="blog-visually-hidden">{copy.readingTimeLabel}</dt>
          <dd>{formatMessage(copy.readingTime, { minutes: readingMinutes })}</dd>
        </div>
      )}
    </dl>
  );
}

export function SourceList({ sources, heading }: { readonly sources: readonly BlogSource[]; readonly heading: string }) {
  if (sources.length === 0) return null;
  return (
    <section aria-labelledby="blog-sources" className="blog-section blog-sources">
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

/**
 * "Read next": texts of the same cluster, then of others, chosen without manual lists. After the app's
 * call to action: the text has just made its point, so the app's next step comes first, this second.
 */
export function RelatedList({ articles, context }: { readonly articles: readonly Pick<BlogArticle, "id" | "slug" | "title" | "description">[]; readonly context: BlogPageContext }) {
  if (articles.length === 0) return null;
  return (
    <section aria-labelledby="blog-related" className="blog-section blog-related">
      <h2 id="blog-related">{context.messages.pages.readNext}</h2>
      <ul>
        {articles.map((article) => (
          <li key={article.id}>
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

function Contents({ headings, label }: { readonly headings: readonly ArticleHeading[]; readonly label: string }) {
  const sections = headings.filter((heading) => heading.level === 2);
  if (sections.length < 2) return null;
  return (
    <nav aria-labelledby="blog-contents" className="blog-contents">
      <p id="blog-contents" className="blog-contents-title">
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
  return (
    <BlogLayout
      context={context}
      title={article.title}
      lead={article.description}
      crumbs={crumbs}
      meta={<ArticleDatesList dates={dates} readingMinutes={body.readingMinutes} context={context} />}
    >
      <JsonLdScript json={jsonLd} />
      <div className="blog-article-layout">
        <Contents headings={body.headings} label={copy.contents} />
        <article className="blog-article">
          {article.summary === null ? null : (
            <aside aria-labelledby="blog-summary" className="blog-summary">
              <h2 id="blog-summary">{copy.summary}</h2>
              <p>{article.summary}</p>
            </aside>
          )}
          <ArticleBody segments={body.segments} />
          {article.faq.length === 0 ? null : (
            <section aria-labelledby="blog-faq" className="blog-section blog-faq">
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
          <SourceList sources={article.sources} heading={copy.sources} />
          <BlogFooterNote context={context} />
        </article>
      </div>
      {cta === undefined ? null : <div className="blog-slot">{cta}</div>}
      <RelatedList articles={related} context={context} />
      {afterArticle === undefined ? null : <div className="blog-slot">{afterArticle}</div>}
    </BlogLayout>
  );
}
