"use client";

import { X } from "lucide-react";
import { useEffect, useRef, type KeyboardEvent, type ReactNode } from "react";

import { en as messages } from "../messages/en.js";
import { Button } from "../ui/button.js";

import { ICON_STROKE_WIDTH } from "./icon-stroke.js";

// `over` and `left` float over the canvas's right or left side; `beside` and `list` sit next to it (after or before)
// and shrink it, and cover the whole canvas on a phone.
export type SidePanelLayout = "over" | "beside" | "left" | "list";

export interface SidePanelProps {
  // Also the `data-testid`; the opener points at it with `aria-controls`.
  readonly id: string;
  readonly heading: string;
  readonly layout: SidePanelLayout;
  readonly isOpen: boolean;
  // The close button and Escape; the caller moves focus back to its opener.
  readonly onClose: () => void;
  // The close button's accessible name, from the app's message layer.
  readonly closeLabel?: string;
  readonly children: ReactNode;
}

// A non-modal panel at a side of a canvas (a map) that leaves the canvas usable. Its parent is a `relative` flex row
// holding the canvas and the panel. Hidden while closed, so its content leaves the reading order.
export function SidePanel({ id, heading, layout, isOpen, onClose, closeLabel = messages.sidePanel.close, children }: SidePanelProps) {
  const panelRef = useRef<HTMLElement>(null);
  const wasOpenRef = useRef(isOpen);
  const headingId = `${id}-heading`;

  // Focus moves in when the panel opens, not when it is open on first render.
  useEffect(() => {
    if (isOpen && !wasOpenRef.current) panelRef.current?.focus();
    wasOpenRef.current = isOpen;
  }, [isOpen]);

  function closeOnEscape(event: KeyboardEvent<HTMLElement>) {
    if (event.key !== "Escape") return;
    event.stopPropagation();
    onClose();
  }

  return (
    <aside
      ref={panelRef}
      id={id}
      tabIndex={-1}
      data-slot="side-panel"
      className="absolute inset-y-0 right-0 z-3 flex w-[min(24rem,100%)] flex-col border-l border-border bg-background text-foreground shadow-menu outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset data-[layout=beside]:relative data-[layout=beside]:w-auto data-[layout=beside]:max-w-full data-[layout=beside]:flex-[0_0_max(50%,24rem)] data-[layout=left]:right-auto data-[layout=left]:left-0 data-[layout=left]:border-r data-[layout=left]:border-l-0 max-sm:data-[layout=beside]:absolute max-sm:data-[layout=beside]:inset-0 max-sm:data-[layout=beside]:w-full max-sm:data-[layout=beside]:border-l-0 data-[layout=list]:relative data-[layout=list]:flex-none data-[layout=list]:border-r data-[layout=list]:border-l-0 max-sm:data-[layout=list]:absolute max-sm:data-[layout=list]:inset-0 max-sm:data-[layout=list]:w-full max-sm:data-[layout=list]:border-r-0 [&[hidden]]:hidden"
      data-layout={layout}
      hidden={!isOpen}
      aria-labelledby={headingId}
      data-testid={id}
      onKeyDown={closeOnEscape}
    >
      <div className="flex items-center justify-between gap-2 border-b border-border py-2 pr-2 pl-4">
        <h2 id={headingId} className="text-heading-3">
          {heading}
        </h2>
        <Button type="button" variant="ghost" size="icon" aria-label={closeLabel} onClick={onClose}>
          <X aria-hidden="true" strokeWidth={ICON_STROKE_WIDTH} />
        </Button>
      </div>
      <div data-slot="side-panel-content" className="grid flex-1 content-start gap-3 overflow-y-auto p-3">
        {children}
      </div>
    </aside>
  );
}
