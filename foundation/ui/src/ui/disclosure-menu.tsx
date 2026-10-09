"use client";

import { type ReactNode, useCallback, useEffect, useId, useRef, useState } from "react";
import { getButtonClass } from "./button.js";
import { type ClassNames, createSlotClassGetter } from "./class-names.js";

// The WAI-ARIA disclosure pattern for navigation: a button that shows and hides a panel of links.
// No `role="menu"`: the panel holds ordinary links, read and tabbed through as such. While open:
// - Escape closes and returns focus to the trigger;
// - a press outside the trigger and the panel closes. It is heard on `document` in the capture phase,
//   so a handler that stops propagation (React 19 does so for events before hydration) cannot hide it;
// - a click on a link inside the panel closes, and so does a new `closeKey` (the app's route);
// - focus moving out by keyboard closes; a pointer moving focus out is the outside press already.

export interface UseDisclosureOptions {
  /** A change closes the disclosure. Pass the route (the pathname), so a navigation closes it. */
  readonly closeKey?: unknown;
  readonly defaultOpen?: boolean;
}

/** Props for the button that shows and hides the panel. */
export interface DisclosureTriggerProps {
  readonly ref: (node: HTMLElement | null) => void;
  readonly "aria-expanded": boolean;
  readonly "aria-controls": string;
  readonly onClick: () => void;
}

/** Props for the panel: its id (the trigger's `aria-controls`) and `hidden` while closed. */
export interface DisclosurePanelProps {
  readonly ref: (node: HTMLElement | null) => void;
  readonly id: string;
  readonly hidden: boolean;
}

export interface Disclosure {
  readonly isOpen: boolean;
  readonly open: () => void;
  /** Closes; focus goes back to the trigger only when `returnFocus` is set (what Escape does). */
  readonly close: (options?: { readonly returnFocus?: boolean }) => void;
  readonly toggle: () => void;
  readonly triggerProps: DisclosureTriggerProps;
  readonly panelProps: DisclosurePanelProps;
}

type InputKind = "keyboard" | "pointer";

/** State and wiring of a disclosure: spread `triggerProps` on a `<button>` and `panelProps` on the panel. */
export function useDisclosure({ closeKey, defaultOpen = false }: UseDisclosureOptions = {}): Disclosure {
  const panelId = useId();
  const [isOpen, setIsOpen] = useState(defaultOpen);
  const [seenCloseKey, setSeenCloseKey] = useState(closeKey);
  const triggerRef = useRef<HTMLElement | null>(null);
  const panelRef = useRef<HTMLElement | null>(null);
  const lastInputRef = useRef<InputKind>("pointer");

  // A new route closes the panel during render, so the next page never shows it open.
  if (!Object.is(seenCloseKey, closeKey)) {
    setSeenCloseKey(closeKey);
    setIsOpen(false);
  }

  const close = useCallback((options?: { readonly returnFocus?: boolean }) => {
    setIsOpen(false);
    if (options?.returnFocus === true) triggerRef.current?.focus();
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    const isInside = (target: EventTarget | null) =>
      target instanceof Node && (triggerRef.current?.contains(target) === true || panelRef.current?.contains(target) === true);

    function handleKeyDown(event: KeyboardEvent) {
      lastInputRef.current = "keyboard";
      if (event.key !== "Escape" || event.defaultPrevented) return;
      event.preventDefault();
      close({ returnFocus: true });
    }
    function handlePointerDown(event: PointerEvent) {
      lastInputRef.current = "pointer";
      if (!isInside(event.target)) close();
    }
    function handleClick(event: MouseEvent) {
      const target = event.target;
      if (!isInside(target)) {
        close();
        return;
      }
      const link = target instanceof Element ? target.closest("a[href]") : null;
      if (link !== null && panelRef.current?.contains(link) === true) close();
    }
    function handleFocusIn(event: FocusEvent) {
      if (lastInputRef.current === "keyboard" && !isInside(event.target)) close();
    }

    document.addEventListener("keydown", handleKeyDown, true);
    document.addEventListener("pointerdown", handlePointerDown, true);
    document.addEventListener("click", handleClick, true);
    document.addEventListener("focusin", handleFocusIn, true);
    return () => {
      document.removeEventListener("keydown", handleKeyDown, true);
      document.removeEventListener("pointerdown", handlePointerDown, true);
      document.removeEventListener("click", handleClick, true);
      document.removeEventListener("focusin", handleFocusIn, true);
    };
  }, [isOpen, close]);

  const setTriggerNode = useCallback((node: HTMLElement | null) => {
    triggerRef.current = node;
  }, []);
  const setPanelNode = useCallback((node: HTMLElement | null) => {
    panelRef.current = node;
  }, []);

  return {
    isOpen,
    open: () => setIsOpen(true),
    close,
    toggle: () => setIsOpen((current) => !current),
    triggerProps: { ref: setTriggerNode, "aria-expanded": isOpen, "aria-controls": panelId, onClick: () => setIsOpen((current) => !current) },
    panelProps: { ref: setPanelNode, id: panelId, hidden: !isOpen },
  };
}

export type DisclosureMenuSlot = "root" | "trigger" | "label" | "panel";
export type DisclosureMenuAlign = "start" | "end";

export interface DisclosureMenuProps extends UseDisclosureOptions {
  /** The trigger's text, or its accessible name when `isLabelHidden`. */
  readonly label: string;
  /** A decorative icon before the label (`MenuIcon`, `UserIcon`). */
  readonly icon?: ReactNode;
  /** Shows only the icon; `label` stays the button's name. */
  readonly isLabelHidden?: boolean;
  /** Which edge of the trigger the panel lines up with; `end` by default. */
  readonly align?: DisclosureMenuAlign;
  /** The panel's content: links, usually in a `<ul>` or a `<nav>`. */
  readonly children: ReactNode;
  readonly classNames?: ClassNames<DisclosureMenuSlot>;
  readonly unstyled?: boolean;
}

const PANEL_ALIGN: Readonly<Record<DisclosureMenuAlign, string>> = { start: "sft:left-0", end: "sft:right-0" };

const PANEL_BASE =
  "sft:absolute sft:top-full sft:z-40 sft:mt-1 sft:flex sft:min-w-48 sft:flex-col sft:gap-0.5 sft:rounded-card sft:border sft:border-border sft:bg-surface-raised sft:p-1 sft:text-sm sft:text-foreground sft:shadow-2 sft:[&[hidden]]:hidden sft:[&_a]:block sft:[&_a]:rounded-control sft:[&_a]:px-3 sft:[&_a]:py-2 sft:[&_a]:text-foreground sft:[&_a]:no-underline sft:[&_a:hover]:bg-foreground/5 sft:[&_a:focus-visible]:outline-2 sft:[&_a:focus-visible]:outline-focus";

/** A button that shows and hides a panel of links (a user menu, a phone navigation). */
export function DisclosureMenu({
  label,
  icon,
  isLabelHidden = false,
  align = "end",
  closeKey,
  defaultOpen,
  children,
  classNames,
  unstyled,
}: DisclosureMenuProps) {
  const { triggerProps, panelProps } = useDisclosure({ closeKey, defaultOpen });
  const slot = createSlotClassGetter<DisclosureMenuSlot>({
    defaults: {
      root: "sft:relative sft:inline-block sft:font-sans",
      trigger: getButtonClass({ variant: "ghost" }),
      label: "",
      panel: `${PANEL_BASE} ${PANEL_ALIGN[align]}`,
    },
    classNames,
    unstyled,
  });
  return (
    <div className={slot("root")}>
      <button type="button" {...triggerProps} aria-label={isLabelHidden ? label : undefined} className={slot("trigger")}>
        {icon}
        {isLabelHidden ? null : <span className={slot("label")}>{label}</span>}
      </button>
      <div {...panelProps} className={slot("panel")}>
        {children}
      </div>
    </div>
  );
}
