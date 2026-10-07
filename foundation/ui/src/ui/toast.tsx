"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { type ClassNames, createSlotClassGetter } from "./class-names.js";
import { CheckIcon } from "./icons.js";

// A short confirmation after a save ("Saved"). One `ToastHost` per page renders a polite live
// region; `announceToast` from anywhere on the client shows a message in it for a few seconds.
// The store is module state in the browser;
// do not call `announceToast` on the server.

const DEFAULT_VISIBLE_MS = 3000;

export interface AnnouncedToast {
  readonly message: string;
  /** Grows with every announcement, so the same message twice is two toasts. */
  readonly token: number;
}

let announced: AnnouncedToast | null = null;
const listeners = new Set<() => void>();

/** Shows `message` in the page's `ToastHost`. */
export function announceToast(message: string): void {
  announced = { message, token: (announced?.token ?? 0) + 1 };
  for (const listener of listeners) listener();
}

function subscribeToAnnouncements(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** The latest announcement, or `null` before the first one. */
export function getAnnouncedToast(): AnnouncedToast | null {
  return announced;
}

function getServerAnnouncedToast(): AnnouncedToast | null {
  return null;
}

/**
 * Whether an announcement is newer than the host: a host mounted later (after a navigation) does
 * not replay the toast of an earlier page.
 */
export function isAnnouncementNew(current: AnnouncedToast | null, tokenAtMount: number): current is AnnouncedToast {
  return current !== null && current.token > tokenAtMount;
}

/** Whether a toast still shows: it has a message and its own timer has not expired yet. */
export function isToastVisible(message: string | undefined, token: number, expiredToken: number | null): boolean {
  return message !== undefined && message !== "" && expiredToken !== token;
}

export type ToastSlot = "region" | "toast" | "icon";

/**
 * Attributes for the live region: an `id` and `data-*` attributes (a stable anchor for an app's
 * browser tests). Role, live-region attributes and classes stay the component's.
 */
export type ToastRegionProps = { readonly id?: string } & { readonly [attribute: `data-${string}`]: string | undefined };

export interface ToastHostProps {
  /** How long a toast stays, in milliseconds. */
  readonly durationMs?: number;
  readonly regionProps?: ToastRegionProps;
  readonly classNames?: ClassNames<ToastSlot>;
  readonly unstyled?: boolean;
}

const DEFAULT_CLASSES: Readonly<Record<ToastSlot, string>> = {
  region: "sft:pointer-events-none sft:fixed sft:inset-x-4 sft:bottom-4 sft:z-50 sft:font-sans sft:sm:bottom-6",
  toast:
    "sft:mx-auto sft:flex sft:w-fit sft:items-center sft:gap-2 sft:rounded-control sft:border sft:border-border-strong sft:bg-surface-raised sft:px-4 sft:py-2.5 sft:text-sm sft:text-foreground sft:shadow-2 sft:transition sft:duration-(--sft-duration-base) sft:starting:translate-y-2 sft:starting:opacity-0 sft:motion-reduce:transition-none",
  icon: "sft:shrink-0 sft:text-success",
};

function pickRegionAttributes(props: ToastRegionProps | undefined): Record<string, string | undefined> {
  if (props === undefined) return {};
  // Filtered at runtime too: an untyped caller must not replace the role or the live-region attributes.
  return Object.fromEntries(Object.entries(props).filter(([name]) => name === "id" || name.startsWith("data-")));
}

/**
 * The live region toasts appear in. It is always in the page (empty when idle), so screen readers
 * announce what is added to it; it is a live region, so an open modal does not make it inert.
 */
export function ToastHost({ durationMs = DEFAULT_VISIBLE_MS, regionProps, classNames, unstyled }: ToastHostProps) {
  const current = useSyncExternalStore(subscribeToAnnouncements, getAnnouncedToast, getServerAnnouncedToast);
  const [tokenAtMount] = useState(() => getAnnouncedToast()?.token ?? 0);
  const [expiredToken, setExpiredToken] = useState<number | null>(null);
  const shown = isAnnouncementNew(current, tokenAtMount) ? current : null;
  const isVisible = shown !== null && isToastVisible(shown.message, shown.token, expiredToken);
  const visibleToken = isVisible ? shown.token : null;

  useEffect(() => {
    if (visibleToken === null) return;
    const timer = setTimeout(() => setExpiredToken(visibleToken), durationMs);
    return () => clearTimeout(timer);
  }, [visibleToken, durationMs]);

  const slot = createSlotClassGetter({ defaults: DEFAULT_CLASSES, classNames, unstyled });
  return (
    <div role="status" aria-live="polite" aria-atomic="true" {...pickRegionAttributes(regionProps)} className={slot("region")}>
      {isVisible ? (
        <div key={shown.token} className={slot("toast")}>
          <CheckIcon className={slot("icon")} />
          {shown.message}
        </div>
      ) : null}
    </div>
  );
}
