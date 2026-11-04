"use client";

import { useIsMobile } from "@softure-ai/theme-kit/react";
import { ChevronsLeft, ChevronsRight, PanelLeft, PanelRightClose, PanelRightOpen } from "lucide-react";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ComponentProps,
  type ReactNode,
  type RefObject,
} from "react";

import { cn } from "../lib/utils.js";
import { en as messages } from "../messages/en.js";
import { Button } from "../ui/button.js";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "../ui/sheet.js";
import { SidebarProvider } from "../ui/sidebar.js";

import { ICON_STROKE_WIDTH } from "./icon-stroke.js";
import { isOverlayOpen } from "./overlay-open.js";

// `standard` takes two fifths of the shell, `half` splits the shell half and half between the content and the panel.
export type AsidePanelWidth = "standard" | "half";

// What the app keeps per signed-in user, so the panel opens the same way across screens, reloads and devices.
export interface AsidePanelState {
  readonly isOpen: boolean;
  readonly width: AsidePanelWidth;
}

export type AsidePanelProviderProps = Omit<ComponentProps<typeof SidebarProvider>, "open" | "onOpenChange" | "hidden"> & {
  // The kept state the panel starts from on a wide screen; a phone always starts closed.
  readonly initialState: AsidePanelState;
  // Called with the new state after each change on a wide screen; a failed save keeps the choice on the page.
  readonly save?: (state: AsidePanelState) => void | Promise<void>;
  // Receives a failed save (a rejected promise or a thrown error).
  readonly onSaveError?: (error: unknown) => void;
  // A screen that offers no panel: no toggle, no panel, and the sidebar stays open whatever the kept state says.
  readonly isHidden?: boolean;
  // The panel's `id`, which the toggle points at with `aria-controls`.
  readonly panelId?: string;
};

interface AsidePanelContextValue {
  readonly panelId: string;
  readonly isOpen: boolean;
  readonly width: AsidePanelWidth;
  readonly isMobile: boolean;
  readonly isHidden: boolean;
  readonly isSidebarFolded: boolean;
  readonly toggleRef: RefObject<HTMLButtonElement | null>;
  readonly isHeadingFocusRequested: RefObject<boolean>;
  readonly toggle: () => void;
  readonly close: () => void;
  readonly setWidth: (width: AsidePanelWidth) => void;
  readonly openSidebar: () => void;
}

const AsidePanelContext = createContext<AsidePanelContextValue | null>(null);

/** The panel's state and actions, for an app that builds its own toggle or reads whether the panel is open. */
export function useAsidePanel(): Pick<AsidePanelContextValue, "panelId" | "isOpen" | "width" | "isMobile" | "isHidden" | "isSidebarFolded" | "toggle" | "close" | "setWidth" | "openSidebar"> {
  const context = useContext(AsidePanelContext);
  if (context === null) throw new Error("useAsidePanel must be used within an AsidePanelProvider.");
  return context;
}

function useAsidePanelContext(component: string): AsidePanelContextValue {
  const context = useContext(AsidePanelContext);
  if (context === null) throw new Error(`${component} must be used within an AsidePanelProvider.`);
  return context;
}

/**
 * The app shell's provider: renders `SidebarProvider` and keeps one side panel open at a time. While the right panel
 * is open on a wide screen, the left sidebar is folded (offcanvas); opening the sidebar any way closes the panel.
 * Use it in place of `SidebarProvider`; every other `SidebarProvider` prop passes through.
 */
export function AsidePanelProvider({
  initialState,
  save,
  onSaveError,
  isHidden = false,
  panelId = "aside-panel",
  defaultOpen = true,
  children,
  ...props
}: AsidePanelProviderProps) {
  const isMobile = useIsMobile();
  const [kept, setKept] = useState<AsidePanelState>(initialState);
  const [isMobileOpen, setMobileOpen] = useState(false);
  const [isSidebarOpen, setSidebarOpen] = useState(defaultOpen);
  const toggleRef = useRef<HTMLButtonElement>(null);
  const isHeadingFocusRequested = useRef(false);

  const isOpen = isHidden ? false : isMobile ? isMobileOpen : kept.isOpen;
  const isSidebarShown = isSidebarOpen && !(kept.isOpen && !isMobile && !isHidden);

  const keep = useCallback(
    (next: AsidePanelState) => {
      setKept(next);
      if (save === undefined) return;
      // The choice stays on the page when the save fails; the app hears about it through `onSaveError`.
      Promise.resolve()
        .then(() => save(next))
        .catch((error: unknown) => onSaveError?.(error));
    },
    [save, onSaveError],
  );

  const setPanelOpen = useCallback(
    (next: boolean) => {
      if (isMobile) setMobileOpen(next);
      else if (next !== kept.isOpen) keep({ ...kept, isOpen: next });
    },
    [isMobile, kept, keep],
  );

  const toggle = useCallback(() => {
    if (!isOpen) isHeadingFocusRequested.current = true;
    setPanelOpen(!isOpen);
  }, [isOpen, setPanelOpen]);

  const close = useCallback(() => setPanelOpen(false), [setPanelOpen]);

  const setWidth = useCallback(
    (width: AsidePanelWidth) => {
      if (width !== kept.width) keep({ ...kept, width });
    },
    [kept, keep],
  );

  const openSidebar = useCallback(() => {
    setSidebarOpen(true);
    if (kept.isOpen && !isMobile) keep({ ...kept, isOpen: false });
  }, [isMobile, kept, keep]);

  const changeSidebar = useCallback(
    (next: boolean) => {
      if (next) openSidebar();
      else setSidebarOpen(false);
    },
    [openSidebar],
  );

  const value = useMemo<AsidePanelContextValue>(
    () => ({
      panelId,
      isOpen,
      width: kept.width,
      isMobile,
      isHidden,
      isSidebarFolded: !isSidebarShown,
      toggleRef,
      isHeadingFocusRequested,
      toggle,
      close,
      setWidth,
      openSidebar,
    }),
    [panelId, isOpen, kept.width, isMobile, isHidden, isSidebarShown, toggle, close, setWidth, openSidebar],
  );

  return (
    <AsidePanelContext.Provider value={value}>
      <SidebarProvider open={isSidebarShown} onOpenChange={changeSidebar} {...props}>
        {children}
      </SidebarProvider>
    </AsidePanelContext.Provider>
  );
}

export interface AsidePanelToggleProps {
  // The accessible names while closed and while open, from the app's message layer.
  readonly showLabel?: string;
  readonly hideLabel?: string;
  readonly className?: string;
}

/** The icon button at the top-right edge that shows and hides the panel; it stays in place either way. */
export function AsidePanelToggle({ showLabel = messages.asidePanel.show, hideLabel = messages.asidePanel.hide, className }: AsidePanelToggleProps) {
  const { panelId, isOpen, isHidden, toggleRef, toggle } = useAsidePanelContext("AsidePanelToggle");
  if (isHidden) return null;
  const Icon = isOpen ? PanelRightClose : PanelRightOpen;

  return (
    <Button
      ref={toggleRef}
      type="button"
      data-slot="aside-panel-toggle"
      variant={isOpen ? "secondary" : "outline"}
      size="icon"
      aria-expanded={isOpen}
      aria-controls={panelId}
      aria-label={isOpen ? hideLabel : showLabel}
      className={cn("fixed top-[calc(--spacing(2)+env(safe-area-inset-top))] right-[calc(--spacing(2)+env(safe-area-inset-right))] z-20", className)}
      onClick={toggle}
    >
      <Icon aria-hidden="true" strokeWidth={ICON_STROKE_WIDTH} />
    </Button>
  );
}

export interface AsidePanelSidebarOpenerProps {
  // The accessible name ("show the menu and hide the panel"), from the app's message layer.
  readonly label?: string;
  readonly className?: string;
}

/** The icon button at the top-left edge, shown only while the sidebar is folded: brings it back, closes the panel. */
export function AsidePanelSidebarOpener({ label = messages.asidePanel.showSidebar, className }: AsidePanelSidebarOpenerProps) {
  const { isMobile, isSidebarFolded, openSidebar } = useAsidePanelContext("AsidePanelSidebarOpener");
  if (isMobile || !isSidebarFolded) return null;

  return (
    <Button
      type="button"
      data-slot="aside-panel-sidebar-opener"
      variant="outline"
      size="icon"
      aria-label={label}
      className={cn("fixed top-[calc(--spacing(2)+env(safe-area-inset-top))] left-[calc(--spacing(2)+env(safe-area-inset-left))] z-20", className)}
      onClick={openSidebar}
    >
      <PanelLeft aria-hidden="true" strokeWidth={ICON_STROKE_WIDTH} />
    </Button>
  );
}

export interface AsidePanelProps {
  readonly title: string;
  // The panel's body, rendered only while the panel is open: pass a lazily loaded component (`next/dynamic` with
  // `ssr: false`, or `React.lazy`), so screens that never open the panel never load its code.
  readonly children: ReactNode;
  // The width switch's accessible names, from the app's message layer.
  readonly widenLabel?: string;
  readonly narrowLabel?: string;
  // The phone sheet's close button text.
  readonly closeLabel?: string;
  readonly className?: string;
}

/**
 * The panel: an `aside` beside the shell's content on a wide screen (the content narrows next to it), a right `Sheet`
 * on a phone. Place it after `SidebarInset` inside `AsidePanelProvider`.
 */
export function AsidePanel({
  title,
  children,
  widenLabel = messages.asidePanel.widen,
  narrowLabel = messages.asidePanel.narrow,
  closeLabel,
  className,
}: AsidePanelProps) {
  const { panelId, isOpen, width, isMobile, isHidden, toggleRef, isHeadingFocusRequested, close, setWidth } = useAsidePanelContext("AsidePanel");
  const headingRef = useRef<HTMLHeadingElement>(null);
  const headingId = `${panelId}-heading`;
  const isDesktopOpen = isOpen && !isMobile && !isHidden;

  // Opening from the toggle moves focus to the heading; a panel kept open on load leaves focus alone.
  useEffect(() => {
    if (!isDesktopOpen || !isHeadingFocusRequested.current) return;
    isHeadingFocusRequested.current = false;
    headingRef.current?.focus();
  }, [isDesktopOpen, isHeadingFocusRequested]);

  // Escape closes the panel and returns focus to the toggle, unless an open overlay takes the key first.
  useEffect(() => {
    if (!isDesktopOpen) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape" || event.defaultPrevented || isOverlayOpen(document)) return;
      close();
      toggleRef.current?.focus();
    };
    document.addEventListener("keydown", closeOnEscape);
    return () => document.removeEventListener("keydown", closeOnEscape);
  }, [isDesktopOpen, close, toggleRef]);

  if (isHidden) return null;

  if (isMobile) {
    return (
      <Sheet open={isOpen} onOpenChange={(next) => !next && close()}>
        <SheetContent
          id={panelId}
          side="right"
          data-slot="aside-panel-sheet"
          aria-describedby={undefined}
          closeLabel={closeLabel}
          className={cn("w-full gap-0 sm:max-w-none", className)}
          onOpenAutoFocus={(event) => {
            event.preventDefault();
            headingRef.current?.focus();
          }}
          onCloseAutoFocus={(event) => {
            event.preventDefault();
            toggleRef.current?.focus();
          }}
        >
          <SheetHeader className="border-b border-border">
            <SheetTitle ref={headingRef} tabIndex={-1} className="outline-none">
              {title}
            </SheetTitle>
          </SheetHeader>
          <div data-slot="aside-panel-content" className="min-h-0 flex-1 overflow-y-auto">
            {isOpen ? children : null}
          </div>
        </SheetContent>
      </Sheet>
    );
  }

  if (!isOpen) return null;
  const isHalf = width === "half";
  const WidthIcon = isHalf ? ChevronsRight : ChevronsLeft;

  return (
    <aside
      id={panelId}
      data-slot="aside-panel"
      data-width={width}
      aria-labelledby={headingId}
      className={cn(
        "sticky top-0 flex h-dvh w-2/5 shrink-0 flex-col border-l border-border bg-background text-foreground data-[width=half]:w-1/2",
        className,
      )}
    >
      <div data-slot="aside-panel-header" className="flex h-11 shrink-0 items-center gap-2 border-b border-border pr-12 pl-4">
        <h2 ref={headingRef} id={headingId} tabIndex={-1} className="min-w-0 flex-1 truncate text-heading-3 outline-none">
          {title}
        </h2>
        <Button type="button" variant="ghost" size="icon" aria-label={isHalf ? narrowLabel : widenLabel} onClick={() => setWidth(isHalf ? "standard" : "half")}>
          <WidthIcon aria-hidden="true" strokeWidth={ICON_STROKE_WIDTH} />
        </Button>
      </div>
      <div data-slot="aside-panel-content" className="min-h-0 flex-1 overflow-y-auto">
        {children}
      </div>
    </aside>
  );
}
