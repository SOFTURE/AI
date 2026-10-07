"use client";

import { type ReactNode, useCallback, useEffect, useId, useLayoutEffect, useRef, useState, useSyncExternalStore } from "react";
import { type ClassNames, createSlotClassGetter } from "./class-names.js";

const VIEWPORT_MARGIN_PX = 8;
// Equal to the trigger's hit area (`before:-inset-1.5`), so the pointer can move onto the bubble
// without leaving the hint.
const DEFAULT_TRIGGER_GAP_PX = 6;
/** A bubble without a size yet (still laid out) is measured again on the next frames, this often. */
const MAX_MEASURE_RETRIES = 10;

export interface BubbleRect {
  readonly left: number;
  readonly right: number;
  readonly top: number;
  readonly bottom: number;
}

export interface BubblePlacement {
  readonly isAnchoredLeft: boolean;
  readonly left: number;
  readonly top: number;
  readonly opensAbove: boolean;
}

function clamp(value: number, min: number, max: number): number {
  if (max < min) return min;
  return Math.min(Math.max(value, min), max);
}

/**
 * Where an open bubble stands, in viewport coordinates. It keeps its preferred side when it fits,
 * flips to the other side when only that one fits, and is clamped inside the viewport otherwise
 * (a bubble wider than the viewport loses its end, not its beginning). It opens above the trigger
 * unless there is more room below.
 */
export function resolveBubblePlacement({
  trigger,
  bubble,
  viewport,
  isAnchoredLeft,
  gap = DEFAULT_TRIGGER_GAP_PX,
}: {
  trigger: BubbleRect;
  bubble: { width: number; height: number };
  viewport: { width: number; height: number };
  isAnchoredLeft: boolean;
  /** Distance between the trigger and the bubble, in px; 6 by default. */
  gap?: number;
}): BubblePlacement {
  const leftWhenAnchoredLeft = trigger.left;
  const leftWhenAnchoredRight = trigger.right - bubble.width;
  const fits = (left: number): boolean =>
    left >= VIEWPORT_MARGIN_PX && left + bubble.width <= viewport.width - VIEWPORT_MARGIN_PX;
  const preferredSide = isAnchoredLeft ? leftWhenAnchoredLeft : leftWhenAnchoredRight;
  const otherSide = isAnchoredLeft ? leftWhenAnchoredRight : leftWhenAnchoredLeft;
  const shouldFlip = !fits(preferredSide) && fits(otherSide);
  const left = clamp(
    shouldFlip ? otherSide : preferredSide,
    VIEWPORT_MARGIN_PX,
    viewport.width - VIEWPORT_MARGIN_PX - bubble.width,
  );
  const roomAbove = trigger.top - gap - VIEWPORT_MARGIN_PX;
  const roomBelow = viewport.height - trigger.bottom - gap - VIEWPORT_MARGIN_PX;
  const opensAbove = bubble.height <= roomAbove || roomAbove >= roomBelow;
  const preferredTop = opensAbove ? trigger.top - gap - bubble.height : trigger.bottom + gap;
  const top = clamp(preferredTop, VIEWPORT_MARGIN_PX, viewport.height - VIEWPORT_MARGIN_PX - bubble.height);
  return { isAnchoredLeft: shouldFlip ? !isAnchoredLeft : isAnchoredLeft, left, top, opensAbove };
}

/** Inline style of a placed bubble: fixed, with both opposite edges reset so no class fights it. */
export function getBubbleStyle(placement: BubblePlacement) {
  return {
    position: "fixed",
    left: `${placement.left}px`,
    top: `${placement.top}px`,
    right: "auto",
    bottom: "auto",
  } as const;
}

function isSamePlacement(a: BubblePlacement | null, b: BubblePlacement): boolean {
  return (
    a !== null && a.left === b.left && a.top === b.top && a.isAnchoredLeft === b.isAnchoredLeft && a.opensAbove === b.opensAbove
  );
}

export type HintSlot = "root" | "trigger" | "bubble";

export interface HintProps {
  /** The trigger's accessible name: what the bubble explains ("About: Savings rate"). */
  readonly label: string;
  /** The explanation. */
  readonly children: ReactNode;
  /** Id of the bubble, which the trigger points at with `aria-describedby`; generated when omitted. */
  readonly id?: string;
  /** A fixed wide bubble for long text, instead of one that fits its content. */
  readonly isWide?: boolean;
  /** Open from the trigger to the right (for a trigger near the left edge of its container). */
  readonly anchorLeft?: boolean;
  /** The trigger's glyph; `?` by default. */
  readonly glyph?: ReactNode;
  /** Distance between the trigger and an open bubble, in px; 6 by default (the trigger's hit area). */
  readonly triggerGap?: number;
  readonly classNames?: ClassNames<HintSlot>;
  readonly unstyled?: boolean;
}

const DEFAULT_CLASSES: Readonly<Record<HintSlot, string>> = {
  root: "sft:group/hint sft:relative sft:inline-flex sft:align-middle",
  trigger:
    "sft:relative sft:flex sft:size-4 sft:cursor-help sft:items-center sft:justify-center sft:rounded-full sft:border sft:border-border sft:bg-transparent sft:p-0 sft:font-sans sft:text-xs sft:leading-none sft:text-muted sft:transition-colors sft:duration-(--sft-duration-fast) sft:before:absolute sft:before:-inset-1.5 sft:hover:border-muted sft:hover:text-foreground sft:focus-visible:outline-2 sft:focus-visible:outline-offset-2 sft:focus-visible:outline-focus",
  bubble:
    "sft:absolute sft:bottom-full sft:z-40 sft:mb-2 sft:rounded-control sft:border sft:border-muted/40 sft:bg-background sft:px-3 sft:py-2 sft:text-left sft:font-sans sft:text-xs sft:font-normal sft:normal-case sft:leading-relaxed sft:tracking-normal sft:text-foreground sft:shadow-2",
};

// Before hydration the bubble opens by CSS alone, so the "?" works on a slow device or after a script
// error; once React runs, its state (pin, Escape, placement) takes over through the `hidden` attribute.
const BUBBLE_BEFORE_HYDRATION = "sft:hidden sft:group-hover/hint:block sft:group-focus-within/hint:block";

function subscribeToNothing(): () => void {
  return () => undefined;
}

/** `false` on the server and while hydrating, `true` after; the same on both sides of hydration. */
function useIsHydrated(): boolean {
  return useSyncExternalStore(
    subscribeToNothing,
    () => true,
    () => false,
  );
}

const BUBBLE_SIDE = { left: "sft:left-0", right: "sft:right-0" } as const;
const BUBBLE_WIDTH = {
  wide: "sft:w-88 sft:max-w-[calc(100vw-var(--sft-space-8))]",
  fit: "sft:w-max sft:max-w-60",
} as const;

/**
 * A "?" that explains something next to it. The bubble opens on hover and on focus, and a click
 * pins it open until a click outside, Escape, or focus leaving the hint. Escape closes it however it
 * opened. Before hydration it opens on hover and focus by CSS alone. The explanation is real
 * markup (`role="tooltip"`), never a `title` attribute, and the trigger names what it explains.
 */
export function Hint({
  label,
  children,
  id,
  isWide = false,
  anchorLeft = false,
  glyph,
  triggerGap = DEFAULT_TRIGGER_GAP_PX,
  classNames,
  unstyled,
}: HintProps) {
  const isHydrated = useIsHydrated();
  const generatedId = useId();
  const bubbleId = id ?? generatedId;
  const wrapperRef = useRef<HTMLSpanElement>(null);
  const bubbleRef = useRef<HTMLSpanElement>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [isPinned, setIsPinned] = useState(false);
  const [isAnchoredLeft, setIsAnchoredLeft] = useState(anchorLeft);
  const [placement, setPlacement] = useState<BubblePlacement | null>(null);
  const measureRef = useRef<() => void>(() => undefined);
  const retryRef = useRef<number | null>(null);
  const retryCountRef = useRef(0);
  const isShown = isOpen || isPinned;

  const measure = useCallback(() => {
    const wrapper = wrapperRef.current;
    const bubble = bubbleRef.current;
    if (!wrapper || !bubble) return;
    const triggerRect = wrapper.getBoundingClientRect();
    const bubbleRect = bubble.getBoundingClientRect();
    if (bubbleRect.width === 0 || bubbleRect.height === 0) {
      if (retryCountRef.current >= MAX_MEASURE_RETRIES) return;
      retryCountRef.current += 1;
      retryRef.current = requestAnimationFrame(() => measureRef.current());
      return;
    }
    retryCountRef.current = 0;
    const next = resolveBubblePlacement({
      trigger: triggerRect,
      bubble: { width: bubbleRect.width, height: bubbleRect.height },
      viewport: { width: document.documentElement.clientWidth, height: document.documentElement.clientHeight },
      isAnchoredLeft,
      gap: triggerGap,
    });
    setIsAnchoredLeft(next.isAnchoredLeft);
    setPlacement((current) => (isSamePlacement(current, next) ? current : next));
  }, [isAnchoredLeft, triggerGap]);

  useLayoutEffect(() => {
    measureRef.current = measure;
  }, [measure]);

  useEffect(() => {
    if (!isPinned) return;
    function handlePointerDown(event: PointerEvent) {
      if (!(event.target instanceof Node) || !wrapperRef.current?.contains(event.target)) setIsPinned(false);
    }
    document.addEventListener("pointerdown", handlePointerDown, true);
    return () => document.removeEventListener("pointerdown", handlePointerDown, true);
  }, [isPinned]);

  // Escape dismisses a bubble however it opened (WCAG 1.4.13), and is captured so a surrounding
  // modal does not close with it.
  useEffect(() => {
    if (!isShown) return;
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      event.preventDefault();
      setIsPinned(false);
      setIsOpen(false);
    }
    document.addEventListener("keydown", handleKeyDown, true);
    return () => document.removeEventListener("keydown", handleKeyDown, true);
  }, [isShown]);

  useLayoutEffect(() => {
    if (!isShown) return;
    retryCountRef.current = 0;
    measure();
    const remeasure = () => measure();
    window.addEventListener("scroll", remeasure, true);
    window.addEventListener("resize", remeasure);
    return () => {
      window.removeEventListener("scroll", remeasure, true);
      window.removeEventListener("resize", remeasure);
      if (retryRef.current !== null) {
        cancelAnimationFrame(retryRef.current);
        retryRef.current = null;
      }
    };
  }, [isShown, measure]);

  const slot = createSlotClassGetter({
    defaults: {
      ...DEFAULT_CLASSES,
      bubble: [
        DEFAULT_CLASSES.bubble,
        BUBBLE_SIDE[isAnchoredLeft ? "left" : "right"],
        BUBBLE_WIDTH[isWide ? "wide" : "fit"],
        ...(isHydrated ? [] : [BUBBLE_BEFORE_HYDRATION]),
      ].join(" "),
    },
    classNames,
    unstyled,
  });

  return (
    <span
      ref={wrapperRef}
      className={slot("root")}
      onMouseEnter={() => setIsOpen(true)}
      onMouseLeave={() => setIsOpen(false)}
      onFocus={() => setIsOpen(true)}
      onBlur={(event) => {
        setIsOpen(false);
        // Focus moving to another element unpins; focus lost to nothing (a click on the page) is the
        // outside-pointer handler's call, so a click on the bubble's own text keeps it open.
        if (event.relatedTarget instanceof Node && !event.currentTarget.contains(event.relatedTarget)) {
          setIsPinned(false);
        }
      }}
    >
      <button
        type="button"
        aria-label={label}
        aria-describedby={bubbleId}
        onClick={(event) => {
          if (isPinned) {
            // Unpinning by click closes the bubble now, not when focus leaves the trigger.
            event.currentTarget.blur();
            setIsOpen(false);
          }
          setIsPinned(!isPinned);
        }}
        className={slot("trigger")}
      >
        {glyph ?? "?"}
      </button>
      <span
        ref={bubbleRef}
        id={bubbleId}
        role="tooltip"
        hidden={(isHydrated || unstyled === true) && !isShown}
        className={slot("bubble")}
        style={placement === null ? undefined : getBubbleStyle(placement)}
      >
        {children}
      </span>
    </span>
  );
}
