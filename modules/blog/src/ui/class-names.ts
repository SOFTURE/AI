// The views' class slots: each element the views write has a named slot whose default is its `blog-*`
// class from `styles.css`. An app adds its own class per slot (`classNames`) or drops the defaults
// (`unstyled`), the pattern of @softure-ai/ui's components. The defaults sit in `@layer softure`, so an
// app class wins without `!important`.
import { createSlotClassGetter, type ClassNames } from "@softure-ai/ui";
import type { BlogPageContext } from "./page-context.js";

export const BLOG_SLOT_CLASSES = {
  page: "blog-page",
  header: "blog-header",
  title: "blog-title",
  lead: "blog-lead",
  crumbs: "blog-crumbs",
  crumbsSeparator: "blog-crumbs-separator",
  visuallyHidden: "blog-visually-hidden",
  footerNote: "blog-footer-note",
  signature: "blog-signature",
  disclaimer: "blog-disclaimer",
  empty: "blog-empty",
  slot: "blog-slot",
  groups: "blog-groups",
  group: "blog-group",
  groupTitle: "blog-group-title",
  cards: "blog-cards",
  card: "blog-card",
  cardLead: "blog-card-lead",
  badge: "blog-badge",
  cardTitle: "blog-card-title",
  cardLink: "blog-card-link",
  cardDescription: "blog-card-description",
  cardMeta: "blog-card-meta",
  glossaryTeaser: "blog-glossary-teaser",
  articleLayout: "blog-article-layout",
  article: "blog-article",
  contents: "blog-contents",
  contentsTitle: "blog-contents-title",
  summary: "blog-summary",
  body: "blog-body",
  segment: "blog-segment",
  section: "blog-section",
  faq: "blog-faq",
  sources: "blog-sources",
  related: "blog-related",
  // No default class: `styles.css` styles the read-next list through `.blog-related`; the slots take the app's classes.
  relatedTitle: "",
  relatedList: "",
  relatedItem: "",
  dates: "blog-dates",
  terms: "blog-terms",
  explainedIn: "blog-explained-in",
} as const;

export type BlogSlot = keyof typeof BLOG_SLOT_CLASSES;

/** The app's class per element of the views; see `BLOG_SLOT_CLASSES` for the slots and their defaults. */
export type BlogClassNames = ClassNames<BlogSlot>;

/**
 * The class of each slot for one context: the default plus the app's class, or the app's class alone
 * when `unstyled`. Text meant for screen readers only keeps `blog-visually-hidden` under `unstyled`
 * until the app names its own class for it, so it never shows by accident.
 */
export function getBlogSlotClass(context: Pick<BlogPageContext, "classNames" | "unstyled">): (...slots: readonly BlogSlot[]) => string | undefined {
  const slot = createSlotClassGetter<BlogSlot>({ defaults: BLOG_SLOT_CLASSES, classNames: context.classNames, unstyled: context.unstyled });
  return (...slots) => {
    const parts = slots.map((name) =>
      name === "visuallyHidden" && context.unstyled === true && context.classNames?.visuallyHidden === undefined ? BLOG_SLOT_CLASSES.visuallyHidden : slot(name),
    );
    const joined = parts.filter((part) => part !== undefined).join(" ");
    return joined === "" ? undefined : joined;
  };
}
