import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

import { Badge } from "../ui/badge.js";
import { cn } from "../lib/utils.js";

import { ICON_STROKE_WIDTH } from "./icon-stroke.js";
import type { PaletteColor } from "./palette.js";

// Literal class names, so Tailwind generates each one.
const TEXT_COLOR: Record<PaletteColor, string> = {
  gray: "text-gray",
  brown: "text-brown",
  orange: "text-orange",
  yellow: "text-yellow",
  green: "text-green",
  blue: "text-blue",
  purple: "text-purple",
  pink: "text-pink",
  red: "text-red",
};

export interface StatusProps {
  color: PaletteColor;
  icon: LucideIcon;
  // The word: a status always carries one, so states read apart without telling colours apart.
  children: ReactNode;
  // The full word on hover; defaults to the word itself when it is a string or a number, since a long one is cut.
  title?: string;
  className?: string;
}

/** The word as plain text, or undefined when it is any other node. */
function getPlainText(children: ReactNode): string | undefined {
  return typeof children === "string" || typeof children === "number" ? String(children) : undefined;
}

// A state of something (booked, to pay, overdue): a ghost badge with a line icon and a word in a palette colour.
// In a narrow container the word, not the icon, shrinks and ends in an ellipsis.
export function Status({ color, icon: Icon, children, title, className }: StatusProps) {
  return (
    <Badge
      variant="ghost"
      data-slot="status"
      data-color={color}
      title={title ?? getPlainText(children)}
      className={cn("gap-1.5 px-0 text-sm font-normal [&>svg]:size-4 [&>svg]:shrink-0", TEXT_COLOR[color], className)}
    >
      <Icon aria-hidden="true" strokeWidth={ICON_STROKE_WIDTH} />
      <span data-slot="status-label" className="min-w-0 truncate">
        {children}
      </span>
    </Badge>
  );
}
