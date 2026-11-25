"use client";

import { useEffect, useRef, type ReactNode, type RefObject } from "react";

import { cn } from "../lib/utils.js";

export interface TabBarItem<Key extends string> {
  // Kept on the link as `data-tab`.
  readonly key: Key;
  readonly label: string;
  readonly href: string;
  // Drawn before the label; the caller hides it from assistive technology.
  readonly icon?: ReactNode;
  // Drawn after the label, 0 included.
  readonly count?: number;
}

export interface TabBarProps<Key extends string> {
  // The nav's accessible name.
  readonly label: string;
  readonly tabs: readonly TabBarItem<Key>[];
  readonly current: Key;
  // "touch" draws every tab at least the touch target (44 x 44 px) for a phone view; the default keeps the control's height.
  readonly size?: "default" | "touch";
  // Added to every tab's link after the size, so one breakpoint class brings the pointer size back on a desktop
  // (`size="touch" tabClassName="md:h-control-height md:min-w-0"`).
  readonly tabClassName?: string;
}

const TAB_CLASS =
  "relative inline-flex h-control-height items-center gap-1.5 rounded-md px-2 text-ui-medium whitespace-nowrap text-muted-foreground transition-colors duration-120 after:absolute after:inset-x-0 after:-bottom-1 after:h-0.5 after:bg-foreground after:opacity-0 hover:bg-accent hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none aria-[current=page]:text-foreground aria-[current=page]:after:opacity-100 [&_svg]:size-4 [&_svg]:shrink-0";

const TOUCH_TAB_CLASS = "h-touch-target min-w-touch-target justify-center px-3";

// Static fades (no motion, so nothing to drop under prefers-reduced-motion) on each edge that hides tabs.
const NAV_CLASS =
  "overflow-x-auto border-b border-border data-overflow-start:mask-l-from-[calc(100%---spacing(8))] data-overflow-end:mask-r-from-[calc(100%---spacing(8))]";

// Marks each edge that hides tabs (`data-overflow-start`, `data-overflow-end`); a pixel of rounding is not overflow.
function markOverflowEdges(strip: HTMLElement) {
  strip.toggleAttribute("data-overflow-start", strip.scrollLeft > 1);
  strip.toggleAttribute("data-overflow-end", strip.scrollWidth - strip.clientWidth - strip.scrollLeft > 1);
}

// The edge fade's width (`--spacing(8)` in NAV_CLASS): the current tab keeps this much room, so no fade covers it.
const FADE_WIDTH_PX = 32;

// Scrolls the strip itself (never the page) just far enough that the current tab is whole and clear of the fades.
function scrollTabIntoStrip(strip: HTMLElement, current: string) {
  const link = [...strip.querySelectorAll<HTMLElement>("a[data-tab]")].find((candidate) => candidate.dataset["tab"] === current);
  if (link === undefined) return;
  const linkBox = link.getBoundingClientRect();
  const start = linkBox.left - strip.getBoundingClientRect().left + strip.scrollLeft;
  const end = start + linkBox.width;
  const maxScroll = Math.max(0, strip.scrollWidth - strip.clientWidth);
  if (start < strip.scrollLeft) strip.scrollLeft = Math.max(0, start - FADE_WIDTH_PX);
  else if (end > strip.scrollLeft + strip.clientWidth) strip.scrollLeft = Math.min(maxScroll, end + FADE_WIDTH_PX - strip.clientWidth);
}

// Keeps the current tab in view (on mount and when it changes) and the overflow marks in step (on scroll and resize).
function useStripScroll(strip: RefObject<HTMLElement | null>, current: string) {
  useEffect(() => {
    const element = strip.current;
    if (element === null) return;
    const markEdges = () => markOverflowEdges(element);
    element.addEventListener("scroll", markEdges, { passive: true });
    const observer = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(markEdges);
    observer?.observe(element);
    return () => {
      element.removeEventListener("scroll", markEdges);
      observer?.disconnect();
    };
  }, [strip]);

  useEffect(() => {
    const element = strip.current;
    if (element === null) return;
    scrollTabIntoStrip(element, current);
    markOverflowEdges(element);
  }, [strip, current]);
}

// A screen's tabs as line tabs where each tab is a link, so the shown tab lives in the address and survives a reload.
export function TabBar<Key extends string>({ label, tabs, current, size = "default", tabClassName }: TabBarProps<Key>) {
  const linkClass = cn(TAB_CLASS, size === "touch" && TOUCH_TAB_CLASS, tabClassName);
  const stripRef = useRef<HTMLElement | null>(null);
  useStripScroll(stripRef, current);
  return (
    <nav ref={stripRef} aria-label={label} data-slot="tab-bar" className={NAV_CLASS}>
      <ul className="flex gap-1 pb-1">
        {tabs.map((tab) => (
          <li key={tab.key}>
            <a
              href={tab.href}
              className={linkClass}
              data-tab={tab.key}
              data-size={size === "touch" ? "touch" : undefined}
              aria-current={tab.key === current ? "page" : undefined}
            >
              {tab.icon}
              {tab.label}
              {tab.count === undefined ? null : (
                <span data-slot="tab-bar-count" className="rounded-xs bg-accent px-1 text-small text-muted-foreground tabular-nums">
                  {tab.count}
                </span>
              )}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}
