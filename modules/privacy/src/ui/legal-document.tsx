import type { Locale } from "@softure-ai/core";
import { type ClassNames, createSlotClassGetter } from "@softure-ai/ui";
import { type ReactNode, useId } from "react";
import type { PrivacyMessages } from "../messages/index.js";

// The legal document shell: a title with the version in force and its effective date, a table of
// contents linking to the sections, the sections, and the history of changes. Every word of the
// document is the app's (props); the module adds only its labels, from privacy's messages. An app
// whose page frame already shows the title and its own "in force" sentence leaves out `title` and
// passes `meta={null}`, so the shell adds no heading and no text. A server component: no state and
// no client JavaScript.

/** One section of a document: `id` is its anchor in the table of contents. */
export interface LegalSectionContent {
  /** Kebab-case anchor, unique in the document, e.g. `data-we-collect`. */
  readonly id: string;
  readonly title: ReactNode;
  readonly content: ReactNode;
}

/** One entry of the change history. Without `version` and `date` it is the summary alone. */
export interface LegalChange {
  readonly version?: string;
  /** ISO date, `YYYY-MM-DD`. */
  readonly date?: string;
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
  | "body"
  | "changes"
  | "changesTitle"
  | "changesList"
  | "change"
  | "changeMeta";

/** The line under the title: the module's "Version X · in force since <date>", or the app's own. */
export type LegalDocumentMeta =
  | {
      /** The version in force; read it from the config with `getLegalDocument(config, id).version`. */
      readonly version: string;
      /** ISO date, `YYYY-MM-DD`, from which this version applies. */
      readonly effectiveFrom: string;
      readonly meta?: undefined;
    }
  | {
      /** The app's own line in place of the module's; `null` renders none. */
      readonly meta: ReactNode;
      readonly version?: undefined;
      readonly effectiveFrom?: undefined;
    };

/** The element of the contents title; the navigation is named by it whatever it is. */
export type LegalContentsTitleElement = "h2" | "h3" | "p";

/** The root element of the document. */
export type LegalDocumentElement = "article" | "div" | "section";

interface LegalDocumentBaseProps {
  /** The `<h1>`; leave it out when the app's page frame renders the title. */
  readonly title?: ReactNode;
  readonly intro?: ReactNode;
  readonly sections: readonly LegalSectionContent[];
  /** In the order the reader should see them (usually newest first); none hides the history. */
  readonly changes?: readonly LegalChange[];
  /** Adds the change history as the last link of the contents. */
  readonly listChangesInContents?: boolean;
  /** Default `h2`. */
  readonly contentsTitleAs?: LegalContentsTitleElement;
  /**
   * The anchor of the change history, default `legal-changes`. Give each document its own on a page
   * with two of them.
   */
  readonly changesId?: string;
  /** Default `article`. */
  readonly as?: LegalDocumentElement;
  readonly messages: PrivacyMessages;
  /** Formats the dates. */
  readonly locale: Locale;
  readonly classNames?: ClassNames<LegalDocumentSlot>;
  /** Classes of every section. */
  readonly sectionClassNames?: ClassNames<LegalSectionSlot>;
  readonly unstyled?: boolean;
}

export type LegalDocumentProps = LegalDocumentBaseProps & LegalDocumentMeta;

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
  body: "sft:flex sft:flex-col sft:gap-4",
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

/** The default anchor of the change history section. */
const DEFAULT_CHANGES_ID = "legal-changes";

/** "Version X · <date>", "Version X", the date, or nothing, from what the entry has. */
function formatChangeMeta(change: LegalChange, messages: PrivacyMessages, locale: Locale): string | null {
  const parts: string[] = [];
  if (change.version !== undefined) parts.push(`${messages.legal.version} ${change.version}`);
  if (change.date !== undefined) parts.push(formatLegalDate(change.date, locale));
  return parts.length === 0 ? null : parts.join(" · ");
}

export function LegalDocument(props: LegalDocumentProps) {
  const {
    title,
    intro,
    sections,
    changes = [],
    listChangesInContents = false,
    contentsTitleAs: ContentsTitle = "h2",
    changesId = DEFAULT_CHANGES_ID,
    as: Root = "article",
    messages,
    locale,
    classNames,
    sectionClassNames,
    unstyled,
  } = props;
  const slot = createSlotClassGetter({ defaults: DOCUMENT_CLASSES, classNames, unstyled });
  // Generated, so two documents on one page do not share it; nothing links to it.
  const contentsTitleId = `${useId()}-contents-title`;
  const copy = messages.legal;
  const meta =
    props.version === undefined ? (
      props.meta === null || props.meta === undefined ? null : (
        <div className={slot("meta")}>{props.meta}</div>
      )
    ) : (
      <p className={slot("meta")}>
        {copy.version} {props.version} · {copy.effectiveFrom} {formatLegalDate(props.effectiveFrom, locale)}
      </p>
    );
  const hasTitle = title !== undefined && title !== null;
  const hasHeader = hasTitle || meta !== null || intro !== undefined;
  const contents = [
    ...sections.map((section) => ({ id: section.id, title: section.title })),
    ...(listChangesInContents && changes.length > 0 ? [{ id: changesId, title: copy.changes }] : []),
  ];
  return (
    <Root className={slot("root")}>
      {hasHeader ? (
        <header className={slot("header")}>
          {hasTitle ? <h1 className={slot("title")}>{title}</h1> : null}
          {meta}
          {intro === undefined ? null : <div className={slot("intro")}>{intro}</div>}
        </header>
      ) : null}
      {sections.length === 0 ? null : (
        <nav aria-labelledby={contentsTitleId} className={slot("contents")}>
          <ContentsTitle id={contentsTitleId} className={slot("contentsTitle")}>
            {copy.contents}
          </ContentsTitle>
          <ol className={slot("contentsList")}>
            {contents.map((entry) => (
              <li key={entry.id}>
                <a href={`#${entry.id}`} className={slot("link")}>
                  {entry.title}
                </a>
              </li>
            ))}
          </ol>
        </nav>
      )}
      <div className={slot("body")}>
        {sections.map((section) => (
          <LegalSection key={section.id} id={section.id} title={section.title} classNames={sectionClassNames} unstyled={unstyled}>
            {section.content}
          </LegalSection>
        ))}
        {changes.length === 0 ? null : (
          <section id={changesId} aria-labelledby={`${changesId}-title`} className={slot("changes")}>
            <h2 id={`${changesId}-title`} className={slot("changesTitle")}>
              {copy.changes}
            </h2>
            <ol className={slot("changesList")}>
              {changes.map((change, index) => {
                const changeMeta = formatChangeMeta(change, messages, locale);
                return (
                  // Entries without a version have no natural key; the list is static, so the index is stable.
                  <li key={change.version ?? `change-${index}`} className={slot("change")}>
                    {changeMeta === null ? null : <span className={slot("changeMeta")}>{changeMeta}</span>}
                    <span>{change.summary}</span>
                  </li>
                );
              })}
            </ol>
          </section>
        )}
      </div>
    </Root>
  );
}
