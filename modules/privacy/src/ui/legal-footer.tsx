import { type ClassNames, createSlotClassGetter } from "@softure-ai/ui";
import type { ReactNode } from "react";
import type { PrivacyMessages } from "../messages/index.js";

// The links to the app's legal documents, for the bottom of every page. The app passes the links
// and their labels (its own copy); the navigation's accessible name comes from privacy's messages.
// A server component.

export interface LegalFooterLink {
  readonly href: string;
  readonly label: ReactNode;
}

export type LegalFooterSlot = "root" | "list" | "link" | "note";

export interface LegalFooterProps {
  readonly links: readonly LegalFooterLink[];
  /** A line under the links, e.g. the operator's name and address. */
  readonly note?: ReactNode;
  readonly messages: PrivacyMessages;
  readonly classNames?: ClassNames<LegalFooterSlot>;
  readonly unstyled?: boolean;
}

const DEFAULT_CLASSES: Readonly<Record<LegalFooterSlot, string>> = {
  root: "sft:mx-auto sft:box-border sft:flex sft:w-full sft:flex-col sft:items-center sft:gap-2 sft:border-t sft:border-border sft:px-4 sft:py-4 sft:font-sans sft:text-sm sft:text-muted",
  list: "sft:m-0 sft:flex sft:items-center sft:justify-center sft:gap-4 sft:p-0 sft:list-none",
  link: "sft:text-muted sft:hover:text-foreground sft:focus-visible:outline-2 sft:focus-visible:outline-focus sft:focus-visible:outline-offset-2",
  note: "sft:m-0 sft:text-xs sft:text-center",
};

export function LegalFooter({ links, note, messages, classNames, unstyled }: LegalFooterProps) {
  const slot = createSlotClassGetter({ defaults: DEFAULT_CLASSES, classNames, unstyled });
  return (
    <footer className={slot("root")}>
      <nav aria-label={messages.legal.footer}>
        <ul className={slot("list")}>
          {links.map((link) => (
            <li key={link.href}>
              <a href={link.href} className={slot("link")}>
                {link.label}
              </a>
            </li>
          ))}
        </ul>
      </nav>
      {note === undefined ? null : <p className={slot("note")}>{note}</p>}
    </footer>
  );
}
