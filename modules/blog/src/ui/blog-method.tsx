// "How our texts are made": who writes, where facts come from, sources, checks and corrections. The
// copy is the module's default in `messages.method`; an app states its own method through
// `blog({ messages: { en: { method: { … } } } })`.
import { BlogFooterNote, BlogLayout } from "./blog-layout.js";
import type { BlogPageContext } from "./page-context.js";

const SECTIONS = [
  ["who", "whoTitle", "whoBody"],
  ["facts", "factsTitle", "factsBody"],
  ["sources", "sourcesTitle", "sourcesBody"],
  ["checks", "checksTitle", "checksBody"],
  ["corrections", "correctionsTitle", "correctionsBody"],
] as const;

export function BlogMethodView({ context }: { readonly context: BlogPageContext }) {
  const copy = context.messages.method;
  const crumbs = [
    { name: context.messages.pages.blogTitle, path: context.routes.index },
    { name: copy.title, path: context.methodPath ?? context.routes.index },
  ];
  return (
    <BlogLayout context={context} title={copy.title} lead={copy.description} crumbs={crumbs}>
      <div className="blog-article">
        {SECTIONS.map(([id, title, body]) => (
          <section key={id} id={id} aria-labelledby={`${id}-heading`} className="blog-section">
            <h2 id={`${id}-heading`}>{copy[title]}</h2>
            <p>{copy[body]}</p>
          </section>
        ))}
        <BlogFooterNote context={{ ...context, methodPath: null }} />
      </div>
    </BlogLayout>
  );
}
