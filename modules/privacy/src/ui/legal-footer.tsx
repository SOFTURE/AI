import { type ClassNames, createSlotClassGetter } from "@softure-ai/ui";
import { Fragment, type ReactNode } from "react";
import type { PrivacyMessages } from "../messages/index.js";

// The links to the app's legal documents, for the bottom of every page. The app passes the links
// and their labels (its own copy); the navigation's accessible name comes from privacy's messages.
// Inside the app's own site footer it renders as a `div` or as the navigation alone (`as`), since a
// footer inside a footer is a nested landmark. As a `p` or `span` it is a line of text: the links and
// their separators as inline content, with no navigation and no list. A server component.

export interface LegalFooterLink {
  readonly href: string;
  readonly label: ReactNode;
}

export type LegalFooterSlot = "root" | "list" | "link" | "separator" | "note";

/**
 * The root element. The list form: a `footer` landmark (default), a plain `div`, or the navigation
 * itself, each holding a named navigation with a list of links. The inline form: a `p` or `span`
 * holding the links and separators as text, for a line inside the app's own footer or form.
 */
export type LegalFooterElement = "footer" | "div" | "nav" | "p" | "span";

export interface LegalFooterProps {
  readonly links: readonly LegalFooterLink[];
  /** A line under the links, e.g. the operator's name and address. */
  readonly note?: ReactNode;
  /** Default `footer`; `div` or `nav` inside the app's own site footer; `p` or `span` for one line of text. */
  readonly as?: LegalFooterElement;
  /**
   * Shown between two links. The list form has none by default and hides it from assistive
   * technology; the inline form defaults to `" · "` and reads it as text (`null` for none).
   */
  readonly separator?: ReactNode;
  readonly messages: PrivacyMessages;
  readonly classNames?: ClassNames<LegalFooterSlot>;
  readonly unstyled?: boolean;
}

const DEFAULT_CLASSES: Readonly<Record<LegalFooterSlot, string>> = {
  root: "sft:mx-auto sft:box-border sft:flex sft:w-full sft:flex-col sft:items-center sft:gap-2 sft:border-t sft:border-border sft:px-4 sft:py-4 sft:font-sans sft:text-sm sft:text-muted",
  list: "sft:m-0 sft:flex sft:items-center sft:justify-center sft:gap-4 sft:p-0 sft:list-none",
  link: "sft:text-muted sft:hover:text-foreground sft:focus-visible:outline-2 sft:focus-visible:outline-focus sft:focus-visible:outline-offset-2",
  separator: "",
  note: "sft:m-0 sft:text-xs sft:text-center",
};

// The inline form sits inside the app's own text, so its root keeps only the type and colour.
const INLINE_CLASSES: Readonly<Record<LegalFooterSlot, string>> = {
  ...DEFAULT_CLASSES,
  root: "sft:m-0 sft:font-sans sft:text-sm sft:text-muted",
  list: "",
  note: "",
};

const INLINE_SEPARATOR = " · ";

interface InlineLegalFooterProps {
  readonly links: readonly LegalFooterLink[];
  readonly note?: ReactNode;
  readonly as: "p" | "span";
  readonly separator: ReactNode;
  readonly classNames?: ClassNames<LegalFooterSlot>;
  readonly unstyled?: boolean;
}

function InlineLegalFooter({ links, note, as: Root, separator, classNames, unstyled }: InlineLegalFooterProps) {
  const slot = createSlotClassGetter({ defaults: INLINE_CLASSES, classNames, unstyled });
  const hasSeparator = separator !== undefined && separator !== null;
  const separatorText = hasSeparator ? <span className={slot("separator")}>{separator}</span> : null;
  return (
    <Root className={slot("root")}>
      {links.map((link, index) => (
        <Fragment key={link.href}>
          {index > 0 ? separatorText : null}
          <a href={link.href} className={slot("link")}>
            {link.label}
          </a>
        </Fragment>
      ))}
      {note === undefined || note === null ? null : (
        <>
          {links.length > 0 ? separatorText : null}
          <span className={slot("note")}>{note}</span>
        </>
      )}
    </Root>
  );
}

export function LegalFooter({ links, note, as = "footer", separator, messages, classNames, unstyled }: LegalFooterProps) {
  if (as === "p" || as === "span") {
    return (
      <InlineLegalFooter
        links={links}
        note={note}
        as={as}
        separator={separator === undefined ? INLINE_SEPARATOR : separator}
        classNames={classNames}
        unstyled={unstyled}
      />
    );
  }
  const slot = createSlotClassGetter({ defaults: DEFAULT_CLASSES, classNames, unstyled });
  const hasSeparator = separator !== undefined && separator !== null;
  const list = (
    <ul className={slot("list")}>
      {links.map((link, index) => (
        <li key={link.href}>
          {hasSeparator && index > 0 ? (
            <span aria-hidden className={slot("separator")}>
              {separator}
            </span>
          ) : null}
          <a href={link.href} className={slot("link")}>
            {link.label}
          </a>
        </li>
      ))}
    </ul>
  );
  const noteLine = note === undefined ? null : <p className={slot("note")}>{note}</p>;
  if (as === "nav") {
    return (
      <nav aria-label={messages.legal.footer} className={slot("root")}>
        {list}
        {noteLine}
      </nav>
    );
  }
  const Root = as;
  return (
    <Root className={slot("root")}>
      <nav aria-label={messages.legal.footer}>{list}</nav>
      {noteLine}
    </Root>
  );
}
