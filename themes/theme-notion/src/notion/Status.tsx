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
  className?: string;
}

// A state of something (booked, to pay, overdue): a ghost badge with a line icon and a word in a palette colour.
export function Status({ color, icon: Icon, children, className }: StatusProps) {
  return (
    <Badge
      variant="ghost"
      data-slot="status"
      data-color={color}
      className={cn("gap-1.5 px-0 text-sm font-normal [&>svg]:size-4", TEXT_COLOR[color], className)}
    >
      <Icon aria-hidden="true" strokeWidth={ICON_STROKE_WIDTH} />
      {children}
    </Badge>
  );
}
