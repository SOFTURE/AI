import { ChevronDown, Plus } from "lucide-react";
import type { ReactNode } from "react";

import { en as messages } from "../messages/en.js";
import { DropdownMenu, DropdownMenuContent, DropdownMenuTrigger } from "../ui/dropdown-menu.js";
import { cn } from "../lib/utils.js";

import { ICON_STROKE_WIDTH } from "./icon-stroke.js";

export interface FilterChipProps {
  /** The filtered field, as shown before the value: "Status:". */
  readonly label: string;
  /** The chosen option's text; the app's word for "all" when none is chosen. */
  readonly value: string;
  /** Drawn before the label; the caller hides it from assistive technology. */
  readonly icon?: ReactNode;
  /** A non-default value is chosen: the pill turns into the blue tag. */
  readonly isActive?: boolean;
  /** The options, as `DropdownMenu` items (radio items for one choice). */
  readonly children: ReactNode;
  readonly className?: string;
}

export interface FilterChipAddProps {
  /** The pill's text; default "Add filter". */
  readonly label?: string;
  /** The fields that can be filtered, as `DropdownMenu` items. */
  readonly children: ReactNode;
  readonly className?: string;
}

const PILL_CLASS =
  "inline-flex h-6 shrink-0 cursor-pointer items-center gap-1 rounded-full px-2 text-sm whitespace-nowrap text-muted-foreground transition-colors duration-120 outline-none hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring data-[state=open]:bg-accent [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-3.5";

const ACTIVE_CLASS =
  "data-[active]:bg-blue-tag data-[active]:text-blue-tag-foreground data-[active]:hover:bg-blue-tag data-[active]:data-[state=open]:bg-blue-tag";

// A list filter drawn the way a Notion database view draws it: a small pill `icon · Label: value ▾` above a table
// that opens a menu of options in the design system's popover.
export function FilterChip({ label, value, icon, isActive = false, children, className }: FilterChipProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        data-slot="filter-chip"
        data-active={isActive ? "" : undefined}
        className={cn(PILL_CLASS, ACTIVE_CLASS, className)}
      >
        {icon}
        <span>{label}</span>
        <span data-slot="filter-chip-value" className="font-medium">
          {value}
        </span>
        <ChevronDown aria-hidden="true" strokeWidth={ICON_STROKE_WIDTH} />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start">{children}</DropdownMenuContent>
    </DropdownMenu>
  );
}

// The "+ Add filter" pill next to the filters: the same height, a ghost look, a menu of the fields to filter by.
export function FilterChipAdd({ label = messages.filterChip.add, children, className }: FilterChipAddProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger data-slot="filter-chip-add" className={cn(PILL_CLASS, className)}>
        <Plus aria-hidden="true" strokeWidth={ICON_STROKE_WIDTH} />
        <span>{label}</span>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start">{children}</DropdownMenuContent>
    </DropdownMenu>
  );
}
