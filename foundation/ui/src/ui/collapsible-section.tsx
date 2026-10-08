"use client";

import { type ReactNode, useId, useState } from "react";
import { type ClassNames, createSlotClassGetter } from "./class-names.js";
import { DisclosureArrow } from "./disclosure-arrow.js";

export type CollapsibleSectionSlot = "root" | "heading" | "toggle" | "arrow" | "title" | "subtitle" | "content";

/** The heading element that wraps the toggle, when the section names a part of the page outline. */
export type CollapsibleSectionHeadingLevel = 2 | 3 | 4 | 5 | 6;

export interface CollapsibleSectionProps {
  /** The section's name, written on the toggle. */
  readonly title: string;
  /** One line next to the title: a state that changes with the data ("3 of 5 set"), not an explanation. */
  readonly subtitle?: ReactNode;
  /** Open on first render. The state is local: a reload goes back to it. */
  readonly defaultOpen?: boolean;
  /** Wraps the toggle in `h2`…`h6`; no heading by default. */
  readonly headingLevel?: CollapsibleSectionHeadingLevel;
  readonly children?: ReactNode;
  readonly classNames?: ClassNames<CollapsibleSectionSlot>;
  readonly unstyled?: boolean;
}

// The same frame as a boxed card, so a collapsed section and a collapsed card are the same object on screen. The whole
// bar is the toggle, not the arrow alone. Collapsed content stays mounted (`hidden`): unmounting would drop what the
// user typed into a form inside. The rule and gap above the content belong to the content, so a collapsed section ends
// at its bar.
const DEFAULT_CLASSES: Readonly<Record<CollapsibleSectionSlot, string>> = {
  root: "sft:rounded-card sft:border sft:border-border sft:bg-surface sft:p-5 sft:font-sans sft:text-foreground",
  heading: "sft:m-0 sft:text-base sft:font-semibold",
  toggle:
    "sft:group sft:m-0 sft:flex sft:w-full sft:cursor-pointer sft:flex-wrap sft:items-center sft:gap-x-3 sft:gap-y-1 sft:border-0 sft:bg-transparent sft:p-0 sft:text-left sft:font-sans sft:text-foreground sft:focus-visible:outline-2 sft:focus-visible:outline-offset-2 sft:focus-visible:outline-focus",
  arrow:
    "sft:pointer-events-none sft:size-3.5 sft:shrink-0 sft:text-muted sft:transition-transform sft:duration-(--sft-duration-fast) sft:group-hover:text-foreground sft:motion-reduce:transition-none",
  title: "sft:text-base sft:font-semibold sft:tracking-tight sft:text-foreground",
  subtitle: "sft:text-xs sft:font-normal sft:text-muted sft:group-hover:text-foreground",
  content: "sft:mt-4 sft:space-y-4 sft:border-t sft:border-border sft:pt-4",
};

const ARROW_OPEN = "sft:rotate-90";

/** A section whose content folds under a bar with its title: the `CardDisclosure` gesture for any group of content. */
export function CollapsibleSection({
  title,
  subtitle,
  defaultOpen = false,
  headingLevel,
  children,
  classNames,
  unstyled,
}: CollapsibleSectionProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  const contentId = useId();
  const slot = createSlotClassGetter({ defaults: DEFAULT_CLASSES, classNames, unstyled });
  const arrowClass = [slot("arrow"), isOpen && unstyled !== true ? ARROW_OPEN : undefined].filter(Boolean).join(" ");
  const toggle = (
    <button
      type="button"
      aria-expanded={isOpen}
      aria-controls={contentId}
      onClick={() => setIsOpen((open) => !open)}
      className={slot("toggle")}
    >
      <DisclosureArrow className={arrowClass === "" ? undefined : arrowClass} />
      <span className={slot("title")}>{title}</span>
      {subtitle === undefined || subtitle === null ? null : <span className={slot("subtitle")}>{subtitle}</span>}
    </button>
  );
  return (
    <section className={slot("root")}>
      {headingLevel === undefined ? toggle : <SectionHeading level={headingLevel} className={slot("heading")}>{toggle}</SectionHeading>}
      <div id={contentId} hidden={!isOpen} className={slot("content")}>
        {children}
      </div>
    </section>
  );
}

function SectionHeading({ level, className, children }: { level: CollapsibleSectionHeadingLevel; className: string | undefined; children: ReactNode }) {
  const Heading = `h${level}` as const;
  return <Heading className={className}>{children}</Heading>;
}
