// The glossary: the index (terms in alphabetical order with their definitions) and a term page
// (definition first, the body, sources, the articles that expand on the term).
import type { ReactNode } from "react";
import type { BlogArticle } from "../contract.js";
import { formatDay, type ArticleDates } from "../pages/dates.js";
import type { Crumb } from "../pages/listing.js";
import { getArticlePath, getTermPath } from "../pages/paths.js";
import { ArticleBody, SourceList, type RenderedBody } from "./blog-article.js";
import { BlogFooterNote, BlogLayout, JsonLdScript } from "./blog-layout.js";
import { getBlogSlotClass } from "./class-names.js";
import type { BlogPageContext } from "./page-context.js";

export interface GlossaryIndexViewProps {
  readonly context: BlogPageContext;
  /** Already sorted (`sortTerms`). */
  readonly terms: readonly BlogArticle[];
  /** `null` with no terms: an empty set says nothing. */
  readonly jsonLd: string | null;
}

export function GlossaryIndexView({ context, terms, jsonLd }: GlossaryIndexViewProps) {
  const copy = context.messages.glossary;
  const crumbs: Crumb[] = [
    { name: context.messages.pages.blogTitle, path: context.routes.index },
    { name: copy.title, path: context.routes.glossary },
  ];
  const cls = getBlogSlotClass(context);
  return (
    <BlogLayout context={context} title={copy.title} lead={copy.description} crumbs={crumbs}>
      {jsonLd === null ? null : <JsonLdScript json={jsonLd} />}
      {terms.length === 0 ? (
        <p className={cls("empty")}>{copy.empty}</p>
      ) : (
        <dl className={cls("terms")}>
          {terms.map((term) => (
            <div key={term.id}>
              <dt>
                <a href={getTermPath(context.routes, term.slug)}>{term.title}</a>
              </dt>
              <dd>{term.description}</dd>
            </div>
          ))}
        </dl>
      )}
      <BlogFooterNote context={context} />
    </BlogLayout>
  );
}

export interface GlossaryTermViewProps {
  readonly context: BlogPageContext;
  readonly term: BlogArticle;
  readonly dates: ArticleDates;
  readonly body: RenderedBody;
  readonly crumbs: readonly Crumb[];
  readonly jsonLd: string;
  /** Published articles whose text links this term. */
  readonly articles: readonly BlogArticle[];
  readonly cta?: ReactNode;
}

export function GlossaryTermView({ context, term, dates, body, crumbs, jsonLd, articles, cta }: GlossaryTermViewProps) {
  const pages = context.messages.pages;
  const copy = context.messages.glossary;
  const cls = getBlogSlotClass(context);
  const meta = (
    <dl className={cls("dates")}>
      <div>
        <dt>{pages.currentAsOf}</dt>
        <dd>
          <time dateTime={dates.currentAsOf}>{formatDay(dates.currentAsOf, context.locale)}</time>
        </dd>
      </div>
      {dates.updated === null ? null : (
        <div>
          <dt>{pages.updated}</dt>
          <dd>
            <time dateTime={dates.updated}>{formatDay(dates.updated, context.locale)}</time>
          </dd>
        </div>
      )}
    </dl>
  );
  return (
    <BlogLayout context={context} title={term.title} lead={term.description} crumbs={crumbs} meta={meta}>
      <JsonLdScript json={jsonLd} />
      <article className={cls("article")}>
        <ArticleBody segments={body.segments} context={context} />
        <SourceList sources={term.sources} heading={pages.sources} context={context} />
        {articles.length === 0 ? null : (
          <section aria-labelledby="blog-explained-in" className={cls("section", "explainedIn")}>
            <h2 id="blog-explained-in">{copy.explainedIn}</h2>
            <ul>
              {articles.map((article) => (
                <li key={article.id}>
                  <a href={getArticlePath(context.routes, article.slug)}>{article.title}</a>
                </li>
              ))}
            </ul>
          </section>
        )}
        <BlogFooterNote context={context} extraLink={{ href: context.routes.glossary, label: copy.allTerms }} />
      </article>
      {cta === undefined ? null : <div className={cls("slot")}>{cta}</div>}
    </BlogLayout>
  );
}
