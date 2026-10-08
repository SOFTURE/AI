"use client";

import { formatMessage } from "@softure-ai/core";
import { type ReactNode, useState } from "react";
import { type ClassNames, createSlotClassGetter } from "./class-names.js";
import { type CopyProps, getCopy } from "./copy.js";
import { DisclosureArrow } from "./disclosure-arrow.js";
import { useUiLocale } from "./locale.js";

export type CardDisclosureSlot = "bar" | "toggle" | "arrow" | "header" | "content";

export interface CardDisclosureProps extends CopyProps<"card"> {
  /** The card's title, for the toggle's name. */
  readonly title: string;
  /** The card's header, drawn over the toggle. */
  readonly header: ReactNode;
  readonly defaultOpen: boolean;
  readonly children?: ReactNode;
  readonly classNames?: ClassNames<CardDisclosureSlot>;
  readonly unstyled?: boolean;
}

// The whole header bar toggles. The header's own buttons (the "?" hint, the card's action) cannot sit
// inside a button, so the toggle is stretched under the header (`absolute inset-0`) and the header
// passes clicks through to it, except on its own buttons. Collapsed content stays mounted (`hidden`):
// unmounting would drop what the user typed into a form inside.
const DEFAULT_CLASSES: Readonly<Record<CardDisclosureSlot, string>> = {
  bar: "sft:group sft:relative sft:flex sft:items-center sft:gap-3",
  toggle: "sft:absolute sft:inset-0 sft:z-0 sft:m-0 sft:cursor-pointer sft:border-0 sft:bg-transparent sft:p-0 sft:focus-visible:outline-2 sft:focus-visible:outline-offset-2 sft:focus-visible:outline-focus",
  arrow:
    "sft:pointer-events-none sft:size-3.5 sft:shrink-0 sft:text-muted sft:transition-transform sft:duration-(--sft-duration-fast) sft:group-hover:text-foreground sft:motion-reduce:transition-none",
  header: "sft:pointer-events-none sft:relative sft:z-10 sft:min-w-0 sft:grow sft:[&>header]:mb-0 sft:[&_a]:pointer-events-auto sft:[&_button]:pointer-events-auto",
  content: "sft:mt-4 sft:border-t sft:border-border sft:pt-4",
};

const ARROW_OPEN = "sft:rotate-90";

/** A card's collapsible content, with the header bar as the toggle. */
export function CardDisclosure({ title, header, defaultOpen, children, classNames, unstyled, locale, messages }: CardDisclosureProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  const copy = getCopy("card", { locale: useUiLocale(locale), messages });
  const slot = createSlotClassGetter({ defaults: DEFAULT_CLASSES, classNames, unstyled });
  const arrowClass = [slot("arrow"), isOpen && unstyled !== true ? ARROW_OPEN : undefined].filter(Boolean).join(" ");
  return (
    <>
      <div className={slot("bar")}>
        <button
          type="button"
          aria-expanded={isOpen}
          aria-label={formatMessage(isOpen ? copy.collapse : copy.expand, { title })}
          onClick={() => setIsOpen((open) => !open)}
          className={slot("toggle")}
        />
        <DisclosureArrow className={arrowClass === "" ? undefined : arrowClass} />
        <div className={slot("header")}>{header}</div>
      </div>
      <div hidden={!isOpen} className={slot("content")}>
        {children}
      </div>
    </>
  );
}
