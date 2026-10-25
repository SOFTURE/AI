"use client";

import type { LucideIcon } from "lucide-react";
import { useId, type MouseEvent, type ReactNode } from "react";

import { badgeVariants } from "../ui/badge.js";
import { buttonVariants } from "../ui/button.js";
import { cn } from "../lib/utils.js";

import { ICON_STROKE_WIDTH } from "./icon-stroke.js";
import type { PaletteColor } from "./palette.js";

export interface MarkPopoverProps {
  /** The mark's colour: a palette colour that means the worst of what it lists. */
  readonly color: PaletteColor;
  readonly icon: LucideIcon;
  readonly count: number;
  /** The mark's accessible name: what it counts and that it opens a list. */
  readonly label: string;
  readonly heading: string;
  readonly closeLabel: string;
  /** Extra `data-*` attributes kept on the button. */
  readonly buttonData?: Readonly<Record<`data-${string}`, string | undefined>>;
  /** The entries, as phrasing elements with `role="listitem"`. */
  readonly children: ReactNode;
}

// A counted tag (open warnings, tickets to buy) that opens a list of what it counts. The browser's Popover API opens
// it on click or Enter and closes it on Escape or a click outside, with no client state; the panel sits in the top
// layer, so a card's overflow never clips it. Centred on a phone, under its mark where CSS anchor positioning works.
// Phrasing elements only, so the mark fits inside a `<summary>` or a paragraph.
export function MarkPopover({ color, icon: Icon, count, label, heading, closeLabel, buttonData, children }: MarkPopoverProps) {
  const panelId = useId();
  return (
    <span data-slot="mark" className="inline-flex [anchor-scope:--mark]">
      <button
        type="button"
        className={cn(
          badgeVariants({ variant: "tag", color }),
          "cursor-pointer gap-1 font-medium tabular-nums [anchor-name:--mark] focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
        )}
        {...buttonData}
        popoverTarget={panelId}
        aria-haspopup="dialog"
        aria-label={label}
      >
        <Icon aria-hidden="true" strokeWidth={ICON_STROKE_WIDTH} />
        <span aria-hidden="true">{count}</span>
      </button>
      <span
        id={panelId}
        popover="auto"
        role="dialog"
        aria-labelledby={`${panelId}-heading`}
        data-slot="mark-popover"
        className="max-h-[min(24rem,calc(100vh-2rem))] w-[min(22rem,calc(100vw-2rem))] cursor-auto overflow-y-auto rounded-xl bg-popover p-3 text-left text-ui font-normal whitespace-normal text-popover-foreground shadow-menu backdrop:bg-transparent sm:supports-[position-anchor:--mark]:mt-1 sm:supports-[position-anchor:--mark]:mr-0 sm:supports-[position-anchor:--mark]:mb-0 sm:supports-[position-anchor:--mark]:ml-0 sm:supports-[position-anchor:--mark]:[position-anchor:--mark] sm:supports-[position-anchor:--mark]:[position-area:block-end_span-inline-start] sm:supports-[position-anchor:--mark]:[position-try-fallbacks:flip-block,flip-inline]"
        onClick={keepEnclosingDetailsFolded}
      >
        <span className="mb-2 flex items-center justify-between gap-2">
          <span id={`${panelId}-heading`} className="text-ui-medium">
            {heading}
          </span>
          <button
            type="button"
            className={buttonVariants({ variant: "ghost", size: "xs" })}
            popoverTarget={panelId}
            popoverTargetAction="hide"
          >
            {closeLabel}
          </button>
        </span>
        <span role="list" className="flex flex-col gap-2">
          {children}
        </span>
      </span>
    </span>
  );
}

// A click on the panel's text would toggle an enclosing `<details>` (the mark sits in its summary); links and
// buttons inside keep their default.
function keepEnclosingDetailsFolded(event: MouseEvent<HTMLElement>): void {
  if (event.target instanceof Element && event.target.closest("a, button") === null) event.preventDefault();
}
