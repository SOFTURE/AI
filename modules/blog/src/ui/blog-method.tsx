// "How our texts are made": who writes, where facts come from, sources, checks and corrections. The
// copy is the module's default in `messages.method`; an app states its own method through
// `blog({ messages: { en: { method: { … } } } })`. With `blog({ aiDisclosure: true })` the page opens
// with the disclosure that the texts are written with an AI model (AI Act art. 50(4)), and "who writes"
// takes `whoBodyAi`, which claims no human editorial control.
import type { BlogMessages } from "../messages/index.js";
import { BlogFooterNote, BlogLayout } from "./blog-layout.js";
import { getBlogSlotClass } from "./class-names.js";
import type { BlogPageContext } from "./page-context.js";

type MethodKey = keyof BlogMessages["method"];

const AI_SECTION = ["ai", "aiTitle", "aiBody"] as const satisfies readonly [string, MethodKey, MethodKey];

const SECTIONS = [
  ["who", "whoTitle", "whoBody"],
  ["facts", "factsTitle", "factsBody"],
  ["sources", "sourcesTitle", "sourcesBody"],
  ["checks", "checksTitle", "checksBody"],
  ["corrections", "correctionsTitle", "correctionsBody"],
] as const satisfies readonly (readonly [string, MethodKey, MethodKey])[];

function getSections(isAiDisclosed: boolean): readonly (readonly [string, MethodKey, MethodKey])[] {
  if (!isAiDisclosed) return SECTIONS;
  return [AI_SECTION, ...SECTIONS.map(([id, title, body]): readonly [string, MethodKey, MethodKey] => (id === "who" ? [id, title, "whoBodyAi"] : [id, title, body]))];
}

export function BlogMethodView({ context }: { readonly context: BlogPageContext }) {
  const copy = context.messages.method;
  const cls = getBlogSlotClass(context);
  const crumbs = [
    { name: context.messages.pages.blogTitle, path: context.routes.index },
    { name: copy.title, path: context.methodPath ?? context.routes.index },
  ];
  return (
    <BlogLayout context={context} title={copy.title} lead={copy.description} crumbs={crumbs}>
      <div className={cls("article")}>
        {getSections(context.aiDisclosure === true).map(([id, title, body]) => (
          <section key={id} id={id} aria-labelledby={`${id}-heading`} className={cls("section")}>
            <h2 id={`${id}-heading`}>{copy[title]}</h2>
            <p>{copy[body]}</p>
          </section>
        ))}
        <BlogFooterNote context={{ ...context, methodPath: null }} />
      </div>
    </BlogLayout>
  );
}
