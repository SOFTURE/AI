"use client";

import {
  createContext,
  type KeyboardEvent as ReactKeyboardEvent,
  type MouseEvent as ReactMouseEvent,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import { Button, IconButton } from "./button.js";
import { type ClassNames, createSlotClassGetter } from "./class-names.js";
import { type CopyProps, getCopy } from "./copy.js";
import { FormError } from "./feedback.js";
import { CloseIcon } from "./icons.js";
import { useUiCopyProps } from "./locale.js";

// A modal dialog: a header with the title and a close button, a scrolling body and a footer with
// the actions. `width="panel"` is a full-height sheet from the right; `StandingPanel` is that sheet
// kept mounted while closed (a draft inside survives). While open: focus moves into the panel and
// Tab cycles inside it, everything else in `<body>` is `inert` (live regions excepted, so a toast is
// still announced), the page does not scroll, and closing returns focus to the element that opened
// it.

export type ModalWidth = "form" | "confirmation" | "panel";
/** The title's element; `h2` by default. `1` for a panel that is the screen (its own address). */
export type ModalHeadingLevel = 1 | 2 | 3;
export type ModalSlot = "overlay" | "panel" | "header" | "heading" | "title" | "subtitle" | "close";
/**
 * `enter` (default): the dialog animates in and is gone the moment its owner unmounts it. `enter-leave`: closing
 * from inside (Escape, the backdrop, the close button, `ModalFooter`'s Cancel, `useModalClose`) first sets
 * `data-state="closing"` on the overlay and the panel and waits for their transitions or animations to end.
 */
export type ModalMotion = "enter" | "enter-leave";

export interface ModalProps extends CopyProps<"modal"> {
  readonly title: string;
  /** One line under the title; it becomes the dialog's description. */
  readonly subtitle?: string;
  /**
   * `form` (default): half the screen with limits; `confirmation`: a narrow dialog; `panel`: a
   * full-height sheet from the right, 37.5rem wide (full screen on a phone), for a form beside the
   * screen it changes.
   */
  readonly width?: ModalWidth;
  /** The title's element, `h2` by default; the look stays the `title` slot's. */
  readonly headingLevel?: ModalHeadingLevel;
  readonly onClose: () => void;
  /**
   * `false` while closing would lose work in progress (a save that is running): Escape, the
   * backdrop and the close button do nothing.
   */
  readonly isDismissible?: boolean;
  /** `enter` by default; `enter-leave` also animates the close (an app's keyframes key on `data-state`). */
  readonly motion?: ModalMotion;
  readonly children: ReactNode;
  readonly classNames?: ClassNames<ModalSlot>;
  readonly unstyled?: boolean;
}

/** Closes the dialog the way its `motion` asks, then runs `after` (the owner's close). */
type RequestClose = (after: () => void) => void;

const ModalCloseContext = createContext<RequestClose | null>(null);

/**
 * For an app's own close button inside a `Modal`: `closeModal(onClose)` plays the leave motion first when the
 * modal has `motion="enter-leave"`. Outside a modal, or without that motion, it runs `onClose` at once.
 */
export function useModalClose(): RequestClose {
  return useContext(ModalCloseContext) ?? runAtOnce;
}

function runAtOnce(after: () => void): void {
  after();
}

/** The longest wait from a list of CSS times ("0.2s, 150ms"). */
function getLongestTime(durations: string, delays: string): number {
  const toMs = (time: string) => (time.trim().endsWith("ms") ? Number.parseFloat(time) : Number.parseFloat(time) * 1000);
  const delayList = delays.split(",");
  return durations
    .split(",")
    .map((duration, index) => toMs(duration) + toMs(delayList[index % delayList.length] ?? "0s"))
    .filter((time) => Number.isFinite(time))
    .reduce((longest, time) => Math.max(longest, time), 0);
}

/** How long the leave motion of these elements runs, in ms; 0 when nothing moves. */
function getLeaveTime(elements: readonly (HTMLElement | null)[]): number {
  return elements.reduce((longest, element) => {
    if (element === null) return longest;
    const style = getComputedStyle(element);
    return Math.max(
      longest,
      getLongestTime(style.transitionDuration || "0s", style.transitionDelay || "0s"),
      getLongestTime(style.animationDuration || "0s", style.animationDelay || "0s"),
    );
  }, 0);
}

/** A leave motion that never ends (a missing `transitionend`) still closes after this. */
const LEAVE_TIMEOUT_MS = 1000;

/**
 * The close path of a dialog: at once for `enter`; for `enter-leave`, `closing` first and `after` when the
 * overlay's and the panel's transitions or animations end (or straight away when none runs).
 */
function useLeaveMotion(motion: ModalMotion, overlayRef: { readonly current: HTMLElement | null }, panelRef: { readonly current: HTMLElement | null }) {
  const [isClosing, setIsClosing] = useState(false);
  const pendingCloseRef = useRef<(() => void) | null>(null);

  const requestClose = useCallback<RequestClose>(
    (after) => {
      if (motion === "enter") {
        after();
        return;
      }
      if (pendingCloseRef.current !== null) return;
      pendingCloseRef.current = after;
      setIsClosing(true);
    },
    [motion],
  );

  useEffect(() => {
    const after = pendingCloseRef.current;
    const overlay = overlayRef.current;
    if (!isClosing || after === null || overlay === null) return;
    let isDone = false;
    const finish = () => {
      if (isDone) return;
      isDone = true;
      // An owner that keeps the dialog mounted (it refused to close) gets it back open.
      pendingCloseRef.current = null;
      setIsClosing(false);
      after();
    };
    const wait = getLeaveTime([overlay, panelRef.current]);
    if (wait === 0) {
      finish();
      return;
    }
    const handleEnd = (event: Event) => {
      if (event.target === overlay || event.target === panelRef.current) finish();
    };
    overlay.addEventListener("transitionend", handleEnd);
    overlay.addEventListener("animationend", handleEnd);
    const timer = setTimeout(finish, Math.min(wait + 50, LEAVE_TIMEOUT_MS));
    return () => {
      overlay.removeEventListener("transitionend", handleEnd);
      overlay.removeEventListener("animationend", handleEnd);
      clearTimeout(timer);
    };
  }, [isClosing, overlayRef, panelRef]);

  return { isClosing, requestClose };
}

// The overlay animates in with `@starting-style` (`starting:`), so no keyframes or extra CSS. Its
// colour is the `color-overlay` token.
const OVERLAY_BASE =
  "sft:fixed sft:inset-0 sft:z-50 sft:flex sft:bg-overlay sft:font-sans sft:transition-opacity sft:duration-(--sft-duration-base) sft:ease-(--sft-ease-out) sft:starting:opacity-0 sft:data-[state=closing]:pointer-events-none sft:data-[state=closing]:opacity-0 sft:motion-reduce:transition-none";

const OVERLAY_LAYOUT: Readonly<Record<ModalWidth, string>> = {
  form: "sft:items-end sft:justify-center sft:sm:items-center sft:sm:p-4",
  confirmation: "sft:items-end sft:justify-center sft:sm:items-center sft:sm:p-4",
  panel: "sft:items-stretch sft:justify-end",
};

const PANEL_BASE =
  "sft:box-border sft:flex sft:w-full sft:flex-col sft:border-border sft:bg-surface sft:text-left sft:text-sm sft:text-foreground sft:shadow-2 sft:transition-transform sft:duration-(--sft-duration-base) sft:ease-(--sft-ease-out) sft:focus:outline-none sft:motion-reduce:transition-none";

// On a phone a dialog is a sheet from the bottom; from `sm` it stands in the middle. The side panel
// fills the height, so its body grows and the footer sits at the bottom edge.
const SHEET =
  "sft:max-h-[92dvh] sft:rounded-t-card sft:border sft:border-b-0 sft:starting:translate-y-4 sft:data-[state=closing]:translate-y-4 sft:sm:max-h-[calc(100dvh-var(--sft-space-8)*2)] sft:sm:rounded-card sft:sm:border-b";

const PANEL_WIDTH: Readonly<Record<ModalWidth, string>> = {
  form: `${SHEET} sft:sm:w-1/2 sft:sm:min-w-136 sft:sm:max-w-3xl`,
  confirmation: `${SHEET} sft:sm:max-w-md`,
  panel:
    "sft:h-dvh sft:max-h-dvh sft:starting:translate-x-4 sft:data-[state=closing]:translate-x-4 sft:sm:w-150 sft:sm:max-w-full sft:sm:border-l sft:[&_[data-modal-part=body]]:flex-1",
};

const MODAL_CLASSES: Readonly<Record<Exclude<ModalSlot, "overlay" | "panel">, string>> = {
  header: "sft:flex sft:shrink-0 sft:items-start sft:justify-between sft:gap-4 sft:border-b sft:border-border sft:px-5 sft:pt-4 sft:pb-3.5",
  heading: "sft:min-w-0",
  title: "sft:m-0 sft:font-heading sft:text-lg sft:font-semibold sft:tracking-tight sft:text-foreground",
  subtitle: "sft:mt-1 sft:mb-0 sft:text-xs sft:text-muted",
  close: "sft:-mr-1.5",
};

/** A dialog over the page. Render it while it is open; unmounting closes it. */
export function Modal({
  title,
  subtitle,
  width = "form",
  headingLevel = 2,
  onClose,
  isDismissible = true,
  motion = "enter",
  children,
  classNames,
  unstyled,
  locale,
  messages,
}: ModalProps) {
  const titleId = useId();
  const subtitleId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLElement | null>(null);
  const pressedBackdropRef = useRef(false);
  const copy = getCopy("modal", useUiCopyProps("modal", { locale, messages }));
  const { isClosing, requestClose } = useLeaveMotion(motion, overlayRef, panelRef);

  const close = useCallback(() => {
    if (isDismissible) requestClose(onClose);
  }, [isDismissible, onClose, requestClose]);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      // A prevented Escape was handled inside (an open select list closes first).
      // Only the top modal answers, so one Escape closes one dialog of a nested pair.
      if (event.key !== "Escape" || event.defaultPrevented || !isTopModal(overlayRef.current)) return;
      event.preventDefault();
      close();
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [close]);

  useLayoutEffect(() => {
    const overlay = overlayRef.current;
    if (overlay === null) return;
    const active = document.activeElement;
    if (triggerRef.current === null && active instanceof HTMLElement && active !== document.body && !overlay.contains(active)) {
      triggerRef.current = active;
    }
    openModals.push(overlay);
    const disabled = makeSiblingsInert(overlay);
    panelRef.current?.focus();
    lockScroll();
    return () => {
      openModals.splice(openModals.indexOf(overlay), 1);
      releaseInert(disabled);
      unlockScroll();
      returnFocus(triggerRef.current, overlay);
    };
  }, []);

  const handlePanelKeyDown = useCallback((event: ReactKeyboardEvent<HTMLDivElement>) => {
    if (event.defaultPrevented || event.key !== "Tab" || panelRef.current === null) return;
    const target = getNextFocusTarget(getTabbableElements(panelRef.current), document.activeElement, event.shiftKey);
    if (target !== null) {
      event.preventDefault();
      target.focus();
    }
  }, []);

  // Close only on a click that both started and ended on the backdrop: a text selection dragged
  // out of the panel must not close the dialog.
  function handleBackdropMouseDown(event: ReactMouseEvent) {
    pressedBackdropRef.current = event.target === event.currentTarget;
  }
  function handleBackdropClick(event: ReactMouseEvent) {
    if (event.target === event.currentTarget && pressedBackdropRef.current) close();
    pressedBackdropRef.current = false;
  }

  const slot = createSlotClassGetter<ModalSlot>({
    defaults: { overlay: `${OVERLAY_BASE} ${OVERLAY_LAYOUT[width]}`, panel: `${PANEL_BASE} ${PANEL_WIDTH[width]}`, ...MODAL_CLASSES },
    classNames,
    unstyled,
  });

  const Heading = `h${headingLevel}` as const;
  const state = isClosing ? "closing" : "open";
  const overlay = (
    <div
      ref={overlayRef}
      data-state={state}
      onMouseDown={handleBackdropMouseDown}
      onClick={handleBackdropClick}
      className={slot("overlay")}
    >
      <div
        ref={panelRef}
        data-state={state}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={subtitle === undefined ? undefined : subtitleId}
        tabIndex={-1}
        onKeyDown={handlePanelKeyDown}
        className={slot("panel")}
      >
        <div data-modal-part="header" className={slot("header")}>
          <div className={slot("heading")}>
            <Heading id={titleId} className={slot("title")}>
              {title}
            </Heading>
            {subtitle === undefined ? null : (
              <p id={subtitleId} className={slot("subtitle")}>
                {subtitle}
              </p>
            )}
          </div>
          <IconButton
            label={copy.close}
            onClick={close}
            disabled={!isDismissible}
            classNames={{ root: slot("close") }}
            unstyled={unstyled}
          >
            <CloseIcon />
          </IconButton>
        </div>
        <ModalCloseContext value={requestClose}>{children}</ModalCloseContext>
      </div>
    </div>
  );

  return typeof document === "undefined" ? overlay : createPortal(overlay, document.body);
}

export type StandingPanelSlot = "overlay" | "panel" | "header" | "heading" | "title" | "subtitle" | "close";

export interface StandingPanelProps extends CopyProps<"modal"> {
  /** Shown as a dialog; closed, it stays mounted but `hidden`, so what is typed inside survives. */
  readonly isOpen: boolean;
  readonly title: string;
  readonly subtitle?: string;
  /**
   * The title's element, `h2` by default. A panel that is the screen passes `1`; a caller that keeps it
   * closed on the same page can pass `isOpen ? 1 : 2`, so a hidden panel never adds a second `h1`.
   */
  readonly headingLevel?: ModalHeadingLevel;
  /** Escape from inside, the backdrop and the close button; the caller refuses while a save runs. */
  readonly onClose: () => void;
  /** Usually an `ActionForm` with `onCancel`: the body grows and its footer sits at the bottom. */
  readonly children: ReactNode;
  readonly classNames?: ClassNames<StandingPanelSlot>;
  readonly unstyled?: boolean;
}

/**
 * The `panel` sheet, mounted in place for good. `Modal` mounts its content on open and drops it on
 * close; a form whose draft must survive a close (or a visit to another tab) stands here instead.
 * `isOpen` turns on the dialog: role and name, everything outside inert, focus on the panel, Escape
 * from inside it (a confirmation `Modal` opened from the panel answers its own Escape), the backdrop,
 * the scroll lock, and focus back to the opener on close. It is `position: fixed` where it stands,
 * so no ancestor may set `transform`, `filter` or `contain` (they would become its containing block).
 */
export function StandingPanel({
  isOpen,
  title,
  subtitle,
  headingLevel = 2,
  onClose,
  children,
  classNames,
  unstyled,
  locale,
  messages,
}: StandingPanelProps) {
  const titleId = useId();
  const subtitleId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const pressedBackdropRef = useRef(false);
  const copy = getCopy("modal", useUiCopyProps("modal", { locale, messages }));

  useEffect(() => {
    if (!isOpen) return;
    function handleKeyDown(event: KeyboardEvent) {
      const target = event.target;
      if (event.key !== "Escape" || event.defaultPrevented) return;
      if (!(target instanceof Node) || panelRef.current?.contains(target) !== true) return;
      event.preventDefault();
      onClose();
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  useLayoutEffect(() => {
    const overlay = overlayRef.current;
    if (!isOpen || overlay === null) return;
    const active = document.activeElement;
    const trigger = active instanceof HTMLElement && active !== document.body && !overlay.contains(active) ? active : null;
    const disabled = makeSiblingsInert(overlay);
    panelRef.current?.focus();
    lockScroll();
    return () => {
      releaseInert(disabled);
      unlockScroll();
      returnFocus(trigger, overlay);
    };
  }, [isOpen]);

  const handlePanelKeyDown = useCallback((event: ReactKeyboardEvent<HTMLDivElement>) => {
    if (event.defaultPrevented || event.key !== "Tab" || panelRef.current === null) return;
    const target = getNextFocusTarget(getTabbableElements(panelRef.current), document.activeElement, event.shiftKey);
    if (target !== null) {
      event.preventDefault();
      target.focus();
    }
  }, []);

  const slot = createSlotClassGetter<StandingPanelSlot>({
    defaults: { overlay: `${OVERLAY_BASE} ${OVERLAY_LAYOUT.panel} sft:[&[hidden]]:hidden`, panel: `${PANEL_BASE} ${PANEL_WIDTH.panel}`, ...MODAL_CLASSES },
    classNames,
    unstyled,
  });

  const Heading = `h${headingLevel}` as const;
  return (
    <div
      ref={overlayRef}
      hidden={!isOpen}
      data-standing-panel=""
      onMouseDown={(event) => {
        pressedBackdropRef.current = event.target === event.currentTarget;
      }}
      onClick={(event) => {
        if (event.target === event.currentTarget && pressedBackdropRef.current) onClose();
        pressedBackdropRef.current = false;
      }}
      className={slot("overlay")}
    >
      <div
        ref={panelRef}
        role={isOpen ? "dialog" : undefined}
        aria-modal={isOpen ? true : undefined}
        aria-labelledby={titleId}
        aria-describedby={subtitle === undefined ? undefined : subtitleId}
        tabIndex={-1}
        onKeyDown={handlePanelKeyDown}
        className={slot("panel")}
      >
        <div data-modal-part="header" className={slot("header")}>
          <div className={slot("heading")}>
            <Heading id={titleId} className={slot("title")}>
              {title}
            </Heading>
            {subtitle === undefined ? null : (
              <p id={subtitleId} className={slot("subtitle")}>
                {subtitle}
              </p>
            )}
          </div>
          <IconButton label={copy.close} onClick={onClose} classNames={{ root: slot("close") }} unstyled={unstyled}>
            <CloseIcon />
          </IconButton>
        </div>
        {children}
      </div>
    </div>
  );
}

export type ModalBodySlot = "root";

/** The dialog's content; the only part that scrolls. */
export function ModalBody({
  children,
  classNames,
  unstyled,
}: {
  readonly children: ReactNode;
  readonly classNames?: ClassNames<ModalBodySlot>;
  readonly unstyled?: boolean;
}) {
  const slot = createSlotClassGetter<ModalBodySlot>({
    defaults: { root: "sft:flex sft:min-h-0 sft:flex-col sft:gap-3 sft:overflow-y-auto sft:overscroll-contain sft:px-5 sft:py-4" },
    classNames,
    unstyled,
  });
  return (
    <div data-modal-part="body" className={slot("root")}>
      {children}
    </div>
  );
}

/** `cancel` is added to the Cancel button's own look (its `className`), so it can match the app's buttons. */
export type ModalFooterSlot = "root" | "actions" | "cancel";

export interface ModalFooterProps extends CopyProps<"modal"> {
  readonly onCancel: () => void;
  /** A save is running: Cancel is disabled, so the dialog cannot close halfway. */
  readonly isPending?: boolean;
  /** The rejected save's error, above the buttons, where it is seen without scrolling. */
  readonly error?: string;
  /** The primary action, placed after Cancel in the right corner. */
  readonly children?: ReactNode;
  readonly classNames?: ClassNames<ModalFooterSlot>;
  readonly unstyled?: boolean;
}

/** The dialog's actions: Cancel, then the primary action; leaves room for a phone's home bar. */
export function ModalFooter({ onCancel, isPending = false, error, children, classNames, unstyled, locale, messages }: ModalFooterProps) {
  const copy = getCopy("modal", useUiCopyProps("modal", { locale, messages }));
  const closeModal = useModalClose();
  const slot = createSlotClassGetter<ModalFooterSlot>({
    defaults: {
      root: "sft:flex sft:shrink-0 sft:flex-col sft:gap-3 sft:border-t sft:border-border sft:px-5 sft:pt-3 sft:pb-[max(var(--sft-space-3),env(safe-area-inset-bottom))]",
      actions: "sft:flex sft:items-center sft:justify-end sft:gap-2",
      cancel: "",
    },
    classNames,
    unstyled,
  });
  return (
    <div data-modal-part="footer" className={slot("root")}>
      <FormError message={error} unstyled={unstyled} />
      <div className={slot("actions")}>
        <Button variant="secondary" onClick={() => closeModal(onCancel)} disabled={isPending} className={classNames?.cancel} unstyled={unstyled}>
          {copy.cancel}
        </Button>
        {children}
      </div>
    </div>
  );
}

/**
 * A form spanning the body and the footer, so a submit button in the footer submits the fields in
 * the body. It takes no box of its own (`display: contents`).
 */
export function ModalForm({
  action,
  children,
  classNames,
  unstyled,
}: {
  readonly action: (formData: FormData) => void | Promise<void>;
  readonly children: ReactNode;
  readonly classNames?: ClassNames<"root">;
  readonly unstyled?: boolean;
}) {
  const slot = createSlotClassGetter<"root">({ defaults: { root: "sft:contents" }, classNames, unstyled });
  return (
    <form action={action} className={slot("root")}>
      {children}
    </form>
  );
}

/**
 * Where Tab moves focus inside the dialog: from the last element to the first and back with
 * Shift+Tab, and onto the first (or last) from the panel itself. `null` leaves the move to the
 * browser (focus in the middle of the list).
 */
export function getNextFocusTarget<Element>(elements: readonly Element[], active: unknown, shiftKey: boolean): Element | null {
  const first = elements[0];
  const last = elements.at(-1);
  if (first === undefined || last === undefined) return null;
  const index = elements.findIndex((element) => element === active);
  if (index === -1) return shiftKey ? last : first;
  if (shiftKey && index === 0) return last;
  if (!shiftKey && index === elements.length - 1) return first;
  return null;
}

const TABBABLE = [
  "a[href]",
  "button",
  'input:not([type="hidden"])',
  "select",
  "textarea",
  "summary",
  '[contenteditable]:not([contenteditable="false"])',
  "[tabindex]",
]
  .map((selector) => `${selector}:not([tabindex="-1"])`)
  .join(", ");

function getTabbableElements(root: HTMLElement): HTMLElement[] {
  return Array.from(root.querySelectorAll<HTMLElement>(TABBABLE)).filter(
    (element) =>
      !element.matches(":disabled") &&
      element.getClientRects().length > 0 &&
      getComputedStyle(element).visibility !== "hidden" &&
      isRadioTabStop(element, root),
  );
}

/** Tab reaches one radio per group: the checked one, else the first. */
function isRadioTabStop(element: HTMLElement, root: HTMLElement): boolean {
  if (!(element instanceof HTMLInputElement) || element.type !== "radio" || element.name === "") return true;
  const group = Array.from(root.querySelectorAll<HTMLInputElement>(`input[type="radio"][name="${CSS.escape(element.name)}"]`));
  const checked = group.find((radio) => radio.checked);
  return element === (checked ?? group[0]);
}

function isLiveRegion(element: HTMLElement): boolean {
  const role = element.getAttribute("role");
  return element.hasAttribute("aria-live") || role === "status" || role === "alert" || role === "log";
}

/** Makes every other child of `<body>` inert and returns them, for the cleanup to restore. */
// Page-wide state shared by every open modal, so modals closed in any order leave the page as it
// was: the overlays in opening order, how many modals hold each element inert, and the scroll lock.
const openModals: HTMLElement[] = [];
const inertHolds = new Map<HTMLElement, number>();
let scrollLocks = 0;
let overflowBeforeLock = "";

function isTopModal(overlay: HTMLElement | null): boolean {
  return overlay !== null && openModals.at(-1) === overlay;
}

/**
 * Makes everything outside `node` inert: the siblings of `node` and of each of its ancestors up to
 * `body` (for a portalled modal, every other child of `body`). Elements the app made inert itself
 * are left alone.
 */
function makeSiblingsInert(node: HTMLElement): HTMLElement[] {
  const disabled: HTMLElement[] = [];
  let current: HTMLElement | null = node;
  while (current !== null && current !== document.body) {
    const parent: HTMLElement | null = current.parentElement;
    for (const sibling of Array.from(parent?.children ?? [])) {
      if (sibling === current || !(sibling instanceof HTMLElement) || isLiveRegion(sibling)) continue;
      const holds = inertHolds.get(sibling);
      if (holds === undefined) {
        if (sibling.inert) continue;
        sibling.inert = true;
      }
      inertHolds.set(sibling, (holds ?? 0) + 1);
      disabled.push(sibling);
    }
    current = parent;
  }
  return disabled;
}

function releaseInert(elements: readonly HTMLElement[]): void {
  for (const element of elements) {
    const holds = inertHolds.get(element) ?? 1;
    if (holds > 1) {
      inertHolds.set(element, holds - 1);
      continue;
    }
    inertHolds.delete(element);
    element.inert = false;
  }
}

function lockScroll(): void {
  if (scrollLocks === 0) {
    overflowBeforeLock = document.body.style.overflow;
    document.body.style.overflow = "hidden";
  }
  scrollLocks += 1;
}

function unlockScroll(): void {
  scrollLocks -= 1;
  if (scrollLocks === 0) document.body.style.overflow = overflowBeforeLock;
}

/**
 * Returns focus to the opener, unless focus already went somewhere on purpose. An opener that a
 * re-render replaced is found again by its `aria-label` (row actions are icon buttons).
 */
function returnFocus(trigger: HTMLElement | null, overlay: HTMLElement): void {
  if (trigger === null) return;
  const label = trigger.getAttribute("aria-label");
  const focusTrigger = () => {
    const active = document.activeElement;
    const isFocusLost = active === null || active === document.body || !active.isConnected || overlay.contains(active);
    if (!isFocusLost) return;
    const target = trigger.isConnected ? trigger : findButtonByLabel(label);
    target?.focus();
  };
  if (trigger.isConnected) focusTrigger();
  requestAnimationFrame(focusTrigger);
}

function findButtonByLabel(label: string | null): HTMLElement | null {
  if (label === null) return null;
  return document.querySelector<HTMLElement>(`button[aria-label="${CSS.escape(label)}"]`);
}
