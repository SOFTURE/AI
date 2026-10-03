import type { Locale } from "@softure-ai/core";
import { type ClassNames, createSlotClassGetter } from "@softure-ai/ui";
import type { ReactNode } from "react";
import type { PrivacyMessages } from "../messages/index.js";

// The legal document shell: a title with the version in force and its effective date, a table of
// contents linking to the sections, the sections, and the history of changes. Every word of the
// document is the app's (props); the module adds only its labels, from privacy's messages. A
// server component: no state and no client JavaScript.

/** One section of a document: `id` is its anchor in the table of contents. */
export interface LegalSectionContent {
  /** Kebab-case anchor, unique in the document, e.g. `data-we-collect`. */
  readonly id: string;
  readonly title: ReactNode;
  readonly content: ReactNode;
}

/** One entry of the change history. */
export interface LegalChange {
  readonly version: string;
  /** ISO date, `YYYY-MM-DD`. */
  readonly date: string;
  readonly summary: ReactNode;
}

export type LegalSectionSlot = "root" | "title" | "body";

export interface LegalSectionProps {
  readonly id: string;
  readonly title: ReactNode;
  readonly children: ReactNode;
  readonly classNames?: ClassNames<LegalSectionSlot>;
  readonly unstyled?: boolean;
}

const SECTION_CLASSES: Readonly<Record<LegalSectionSlot, string>> = {
  root: "sft:flex sft:flex-col sft:gap-2 sft:scroll-mt-4",
  title: "sft:m-0 sft:font-heading sft:text-lg sft:font-semibold sft:text-foreground",
  body: "sft:flex sft:flex-col sft:gap-2 sft:text-sm sft:leading-relaxed sft:text-foreground",
};

/** A titled section with an anchor; `LegalDocument` renders one per entry of `sections`. */
export function LegalSection({ id, title, children, classNames, unstyled }: LegalSectionProps) {
  const slot = createSlotClassGetter({ defaults: SECTION_CLASSES, classNames, unstyled });
  return (
    <section id={id} aria-labelledby={`${id}-title`} className={slot("root")}>
      <h2 id={`${id}-title`} className={slot("title")}>
        {title}
      </h2>
      <div className={slot("body")}>{children}</div>
    </section>
  );
}

export type LegalDocumentSlot =
  | "root"
  | "header"
  | "title"
  | "meta"
  | "intro"
  | "contents"
  | "contentsTitle"
  | "contentsList"
  | "link"
  | "changes"
  | "changesTitle"
  | "changesList"
  | "change"
  | "changeMeta";

export interface LegalDocumentProps {
  readonly title: ReactNode;
  /** The version in force; read it from the config with `getLegalDocument(config, id).version`. */
  readonly version: string;
  /** ISO date, `YYYY-MM-DD`, from which this version applies. */
  readonly effectiveFrom: string;
  readonly intro?: ReactNode;
  readonly sections: readonly LegalSectionContent[];
  /** Newest first, as the reader expects; none hides the history. */
  readonly changes?: readonly LegalChange[];
  readonly messages: PrivacyMessages;
  /** Formats the dates. */
  readonly locale: Locale;
  readonly classNames?: ClassNames<LegalDocumentSlot>;
  /** Classes of every section. */
  readonly sectionClassNames?: ClassNames<LegalSectionSlot>;
  readonly unstyled?: boolean;
}

const DOCUMENT_CLASSES: Readonly<Record<LegalDocumentSlot, string>> = {
  root: "sft:mx-auto sft:box-border sft:flex sft:w-full sft:flex-col sft:gap-4 sft:sm:max-w-3xl sft:px-4 sft:py-4 sft:font-sans",
  header: "sft:flex sft:flex-col sft:gap-2",
  title: "sft:m-0 sft:font-heading sft:text-2xl sft:sm:text-3xl sft:font-bold sft:tracking-tight sft:text-foreground",
  meta: "sft:m-0 sft:text-sm sft:text-muted",
  intro: "sft:text-sm sft:leading-relaxed sft:text-foreground",
  contents: "sft:flex sft:flex-col sft:gap-2 sft:rounded-card sft:border sft:border-border sft:bg-surface sft:p-4",
  contentsTitle: "sft:m-0 sft:text-base sft:font-semibold sft:text-foreground",
  contentsList: "sft:m-0 sft:flex sft:flex-col sft:gap-1 sft:pl-8 sft:text-sm",
  link: "sft:text-accent sft:focus-visible:outline-2 sft:focus-visible:outline-focus sft:focus-visible:outline-offset-2",
  changes: "sft:flex sft:flex-col sft:gap-2 sft:border-t sft:border-border sft:pt-4 sft:scroll-mt-4",
  changesTitle: "sft:m-0 sft:font-heading sft:text-lg sft:font-semibold sft:text-foreground",
  changesList: "sft:m-0 sft:flex sft:flex-col sft:gap-2 sft:p-0 sft:list-none sft:text-sm",
  change: "sft:flex sft:flex-col sft:gap-1",
  changeMeta: "sft:font-medium sft:text-muted sft:tabular-nums",
};

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

/** `2026-10-01` as the locale writes it (`October 1, 2026` in English); other text as given. */
export function formatLegalDate(date: string, locale: Locale): string {
  const match = ISO_DATE.exec(date);
  if (match === null) return date;
  const [, year, month, day] = match.map(Number) as [number, number, number, number];
  const value = new Date(Date.UTC(year, month - 1, day));
  // A calendar date, so UTC: the server's time zone must not move it to the day before.
  if (value.getUTCDate() !== day) return date;
  return new Intl.DateTimeFormat(locale, { dateStyle: "long", timeZone: "UTC" }).format(value);
}

/** The id of the change history section; the table of contents does not list it. */
const CHANGES_ID = "legal-changes";
const CONTENTS_TITLE_ID = "legal-contents-title";

export function LegalDocument({
  title,
  version,
  effectiveFrom,
  intro,
  sections,
  changes = [],
  messages,
  locale,
  classNames,
  sectionClassNames,
  unstyled,
}: LegalDocumentProps) {
  const slot = createSlotClassGetter({ defaults: DOCUMENT_CLASSES, classNames, unstyled });
  const copy = messages.legal;
  return (
    <article className={slot("root")}>
      <header className={slot("header")}>
        <h1 className={slot("title")}>{title}</h1>
        <p className={slot("meta")}>
          {copy.version} {version} · {copy.effectiveFrom} {formatLegalDate(effectiveFrom, locale)}
        </p>
        {intro === undefined ? null : <div className={slot("intro")}>{intro}</div>}
      </header>
      {sections.length === 0 ? null : (
        <nav aria-labelledby={CONTENTS_TITLE_ID} className={slot("contents")}>
          <h2 id={CONTENTS_TITLE_ID} className={slot("contentsTitle")}>
            {copy.contents}
          </h2>
          <ol className={slot("contentsList")}>
            {sections.map((section) => (
              <li key={section.id}>
                <a href={`#${section.id}`} className={slot("link")}>
                  {section.title}
                </a>
              </li>
            ))}
          </ol>
        </nav>
      )}
      {sections.map((section) => (
        <LegalSection key={section.id} id={section.id} title={section.title} classNames={sectionClassNames} unstyled={unstyled}>
          {section.content}
        </LegalSection>
      ))}
      {changes.length === 0 ? null : (
        <section id={CHANGES_ID} aria-labelledby={`${CHANGES_ID}-title`} className={slot("changes")}>
          <h2 id={`${CHANGES_ID}-title`} className={slot("changesTitle")}>
            {copy.changes}
          </h2>
          <ol className={slot("changesList")}>
            {changes.map((change) => (
              <li key={change.version} className={slot("change")}>
                <span className={slot("changeMeta")}>
                  {copy.version} {change.version} · {formatLegalDate(change.date, locale)}
                </span>
                <span>{change.summary}</span>
              </li>
            ))}
          </ol>
        </section>
      )}
    </article>
  );
}
