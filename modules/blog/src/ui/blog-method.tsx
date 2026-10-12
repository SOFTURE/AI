// "How our texts are made": who writes, where facts come from, sources, checks and corrections. The
// copy is the module's default in `messages.method`; an app states its own method through
// `blog({ messages: { en: { method: { … } } } })`, or replaces the sections with its own `sections`
// when a body needs more than a paragraph (a list of checks, a link, a `mailto:` address). With
// `blog({ aiDisclosure: true })` the page opens with the disclosure that the texts are written with an
// AI model (AI Act art. 50(4)), whatever the sections; the default "who writes" then takes `whoBodyAi`,
// which claims no human editorial control.
import type { ReactNode } from "react";
import type { BlogMessages } from "../messages/index.js";
import { BlogFooterNote, BlogLayout } from "./blog-layout.js";
import { getBlogSlotClass } from "./class-names.js";
import type { BlogPageContext } from "./page-context.js";

/** One section of the method page: `id` is its anchor; a string body renders in a paragraph, any other node as given. */
export interface BlogMethodSection {
  readonly id: string;
  readonly title: string;
  readonly body: ReactNode;
}

export interface BlogMethodViewProps {
  readonly context: BlogPageContext;
  /** The app's sections in place of the default five; the AI disclosure and the footer note stay. */
  readonly sections?: readonly BlogMethodSection[];
}

type MethodKey = keyof BlogMessages["method"];

const DEFAULT_SECTIONS = [
  ["who", "whoTitle", "whoBody"],
  ["facts", "factsTitle", "factsBody"],
  ["sources", "sourcesTitle", "sourcesBody"],
  ["checks", "checksTitle", "checksBody"],
  ["corrections", "correctionsTitle", "correctionsBody"],
] as const satisfies readonly (readonly [string, MethodKey, MethodKey])[];

function getDefaultSections(copy: BlogMessages["method"], isAiDisclosed: boolean): BlogMethodSection[] {
  return DEFAULT_SECTIONS.map(([id, title, body]) => ({ id, title: copy[title], body: copy[id === "who" && isAiDisclosed ? "whoBodyAi" : body] }));
}

function getSections(context: BlogPageContext, sections: readonly BlogMethodSection[] | undefined): readonly BlogMethodSection[] {
  const copy = context.messages.method;
  const isAiDisclosed = context.aiDisclosure === true;
  const listed = sections ?? getDefaultSections(copy, isAiDisclosed);
  return isAiDisclosed ? [{ id: "ai", title: copy.aiTitle, body: copy.aiBody }, ...listed] : listed;
}

export function BlogMethodView({ context, sections }: BlogMethodViewProps) {
  const copy = context.messages.method;
  const cls = getBlogSlotClass(context);
  const crumbs = [
    { name: context.messages.pages.blogTitle, path: context.routes.index },
    { name: copy.title, path: context.methodPath ?? context.routes.index },
  ];
  return (
    <BlogLayout context={context} title={copy.title} lead={copy.description} crumbs={crumbs}>
      <div className={cls("article")}>
        {getSections(context, sections).map(({ id, title, body }) => (
          <section key={id} id={id} aria-labelledby={`${id}-heading`} className={cls("section")}>
            <h2 id={`${id}-heading`}>{title}</h2>
            {typeof body === "string" ? <p>{body}</p> : body}
          </section>
        ))}
        <BlogFooterNote context={{ ...context, methodPath: null }} />
      </div>
    </BlogLayout>
  );
}
