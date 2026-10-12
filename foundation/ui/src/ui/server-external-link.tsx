import type { AnchorHTMLAttributes } from "react";
import { type ClassNames, createSlotClassGetter } from "./class-names.js";
import { type CopyProps, getCopy } from "./copy.js";

// A link to another site, opened in a new tab. `rel` always carries `noopener noreferrer` (the new
// page gets no handle on this one), and a visually hidden note tells screen reader users that the link
// opens a new tab (WCAG 3.2.5). Server-safe: no client directive and no hook, so a page that ships no
// JavaScript can render it; the locale comes by prop (`en` by default). `ExternalLink` is the same
// link with the locale of the nearest `UiLocaleProvider`.

export type ExternalLinkSlot = "root" | "note";

export type ExternalLinkProps = Omit<AnchorHTMLAttributes<HTMLAnchorElement>, "target" | "className"> &
  CopyProps<"externalLink"> & {
    readonly href: string;
    readonly classNames?: ClassNames<ExternalLinkSlot>;
    /** Added to the root after `classNames.root`. */
    readonly className?: string;
    readonly unstyled?: boolean;
  };

const REQUIRED_REL = ["noopener", "noreferrer"] as const;

/** The app's `rel` tokens plus `noopener noreferrer`, each once. Server-safe. */
export function getExternalRel(rel: string | undefined): string {
  const tokens = (rel ?? "").split(/\s+/).filter((token) => token !== "");
  return [...new Set([...tokens, ...REQUIRED_REL])].join(" ");
}

/** A link that opens in a new tab and says so to assistive technology, rendered without client code. */
export function ServerExternalLink({ href, rel, classNames, className, unstyled, locale, messages, children, ...rest }: ExternalLinkProps) {
  const copy = getCopy("externalLink", { locale, messages });
  const root = [classNames?.root, className].filter((part) => part !== undefined && part !== "").join(" ");
  const slot = createSlotClassGetter<ExternalLinkSlot>({
    defaults: { root: "", note: "sft:sr-only" },
    classNames: { ...classNames, root: root === "" ? undefined : root },
    unstyled,
  });
  return (
    <a {...rest} href={href} target="_blank" rel={getExternalRel(rel)} className={slot("root")}>
      {children}
      <span className={slot("note")}> {copy.newTab}</span>
    </a>
  );
}
