"use client";

import { CircleHelp } from "lucide-react";
import { useCallback, useId, useState, type MouseEvent, type ReactNode } from "react";

import { cn } from "../lib/utils.js";
import { en as messages } from "../messages/en.js";
import { Button } from "../ui/button.js";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "../ui/tooltip.js";

import { ICON_STROKE_WIDTH } from "./icon-stroke.js";

export interface HelpTooltipProps {
  /** The hint: shown in the tooltip and kept hidden in the page for a screen reader. */
  readonly children: ReactNode;
  /** The button's accessible name; the English default is "Help". Name the field ("Help for Email") where it helps. */
  readonly label?: string;
  /** The id of the hidden hint, for the field's `aria-describedby`; a generated one when not given. */
  readonly hintId?: string;
  /** The tooltip's side of the button; `top` by default. */
  readonly side?: "top" | "right" | "bottom" | "left";
  /** The tooltip's edge against the button; `center` by default. */
  readonly align?: "start" | "center" | "end";
  /** Told when the tooltip opens (`true`) or closes (`false`). */
  readonly onOpenChange?: (isOpen: boolean) => void;
  /** Classes of the button. */
  readonly className?: string;
  /** Classes of the tooltip. */
  readonly contentClassName?: string;
}

/**
 * A field's "?" help: an icon button whose tooltip opens on hover, focus, click and tap (a phone has no hover), and
 * closes on Escape, a press outside, blur or when the pointer leaves it and the tooltip. A click opens rather than
 * toggles, so a press during which hover opened the tooltip still ends with it open. Below `md` the button is the 44 px
 * touch target. The hint is also rendered hidden under `hintId`, for the field's `aria-describedby`.
 */
export function HelpTooltip({
  children,
  label = messages.helpTooltip.label,
  hintId,
  side = "top",
  align = "center",
  onOpenChange,
  className,
  contentClassName,
}: HelpTooltipProps) {
  const generatedHintId = useId();
  const [isOpen, setIsOpen] = useState(false);

  const changeOpen = useCallback(
    (next: boolean) => {
      setIsOpen((current) => {
        if (current !== next) onOpenChange?.(next);
        return next;
      });
    },
    [onOpenChange],
  );

  const open = (event: MouseEvent<HTMLButtonElement>) => {
    // Radix's trigger closes on every click; a prevented click skips that, and the click opens instead.
    event.preventDefault();
    changeOpen(true);
  };

  return (
    <TooltipProvider>
      <Tooltip open={isOpen} onOpenChange={changeOpen}>
        <TooltipTrigger asChild>
          <Button
            data-slot="help-tooltip-trigger"
            type="button"
            variant="ghost"
            size="icon"
            aria-label={label}
            className={cn("text-muted-foreground max-md:size-touch-target", className)}
            onClick={open}
          >
            <CircleHelp strokeWidth={ICON_STROKE_WIDTH} aria-hidden="true" />
          </Button>
        </TooltipTrigger>
        <TooltipContent side={side} align={align} sideOffset={4} className={cn("max-w-xs", contentClassName)}>
          {children}
        </TooltipContent>
      </Tooltip>
      <span id={hintId ?? generatedHintId} data-slot="help-tooltip-hint" className="sr-only">
        {children}
      </span>
    </TooltipProvider>
  );
}
