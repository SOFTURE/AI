"use client";

import { ChevronLeft, ChevronRight, type LucideIcon } from "lucide-react";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";

import { cn } from "../lib/utils.js";

import { ATLAS_ICON_STROKE_WIDTH } from "./icons.js";

export interface ChipRailProps {
  /** The list's accessible name, e.g. "Countries on the map". */
  readonly label: string;
  /** The names of the arrow buttons, e.g. "Earlier countries" and "Later countries". */
  readonly previousLabel: string;
  readonly nextLabel: string;
  /** The chips, each in its own `<li>`. */
  readonly children: ReactNode;
  readonly className?: string;
}

/** A round paper button the size of a touch target; it stays in the layout when hidden, so the row never jumps. */
const ARROW_LOOK =
  "inline-flex size-touch shrink-0 cursor-pointer items-center justify-center rounded-pill border border-line-strong bg-surface-raised text-foreground transition-[background-color,opacity] hover:bg-foreground/7 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent data-hidden:pointer-events-none data-hidden:opacity-0 [&_svg]:size-4.5";

/** How much of the visible row one arrow press moves. */
const PAGE_SHARE = 0.8;

interface ArrowProps {
  readonly icon: LucideIcon;
  readonly label: string;
  readonly direction: "previous" | "next";
  readonly isShown: boolean;
  readonly onClick: () => void;
}

function Arrow({ icon: Icon, label, direction, isShown, onClick }: ArrowProps) {
  return (
    <button
      type="button"
      data-direction={direction}
      data-hidden={isShown ? undefined : ""}
      aria-label={label}
      aria-hidden={isShown ? undefined : true}
      tabIndex={isShown ? undefined : -1}
      title={label}
      onClick={onClick}
      className={ARROW_LOOK}
    >
      <Icon aria-hidden="true" strokeWidth={ATLAS_ICON_STROKE_WIDTH} />
    </button>
  );
}

/**
 * One row of chips that scrolls sideways without a scrollbar. An arrow at each end shows while there is more in that
 * direction and moves the row by most of its width, so the row ends on a clear edge instead of a chip cut in half
 * with nothing to say it goes on. Flat like the rest: no fade, no shadow.
 */
export function ChipRail({ label, previousLabel, nextLabel, children, className }: ChipRailProps) {
  const listRef = useRef<HTMLUListElement>(null);
  const [canGoBack, setCanGoBack] = useState(false);
  const [canGoForward, setCanGoForward] = useState(false);

  const measure = useCallback(() => {
    const list = listRef.current;
    if (list === null) return;
    setCanGoBack(list.scrollLeft > 1);
    setCanGoForward(list.scrollLeft + list.clientWidth < list.scrollWidth - 1);
  }, []);

  useEffect(() => {
    const list = listRef.current;
    if (list === null) return;
    measure();
    list.addEventListener("scroll", measure, { passive: true });
    const observer = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(measure);
    observer?.observe(list);
    return () => {
      list.removeEventListener("scroll", measure);
      observer?.disconnect();
    };
  }, [measure]);

  const scrollByPage = (sign: 1 | -1) => {
    const list = listRef.current;
    if (list === null) return;
    list.scrollBy({ left: sign * list.clientWidth * PAGE_SHARE, behavior: "smooth" });
  };

  return (
    <div data-slot="chip-rail" className={cn("flex min-w-0 items-center gap-2", className)}>
      <Arrow icon={ChevronLeft} label={previousLabel} direction="previous" isShown={canGoBack} onClick={() => { scrollByPage(-1); }} />
      <ul ref={listRef} aria-label={label} className="m-0 flex min-w-0 flex-1 list-none gap-1.5 overflow-x-auto overscroll-x-contain p-0 [scrollbar-width:none] [&>li]:shrink-0">
        {children}
      </ul>
      <Arrow icon={ChevronRight} label={nextLabel} direction="next" isShown={canGoForward} onClick={() => { scrollByPage(1); }} />
    </div>
  );
}
