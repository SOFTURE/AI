"use client";

import { Slot } from "radix-ui";
import type { ComponentProps } from "react";

import { cn } from "../lib/utils.js";

// Navigation rows inside a `Sheet` (a phone's navigation drawer), shaped like the sidebar's menu but with no
// `SidebarProvider`: a list of items, each holding one full-width row.
export function SheetMenu({ className, ...props }: ComponentProps<"ul">) {
  return <ul data-slot="sheet-menu" className={cn("flex w-full min-w-0 flex-col gap-1", className)} {...props} />;
}

export function SheetMenuItem({ className, ...props }: ComponentProps<"li">) {
  return <li data-slot="sheet-menu-item" className={cn("relative", className)} {...props} />;
}

export interface SheetMenuButtonProps extends ComponentProps<"button"> {
  // Renders the child (a link) with the row's look instead of a button.
  readonly asChild?: boolean;
  // The row of the screen being shown; the caller adds `aria-current="page"` on a link.
  readonly isActive?: boolean;
}

// One row: icon and label left-aligned in the foreground colour, a touch target tall on a phone and a list row
// from `md`, hovered and focused like the sidebar's rows on the sheet's `background`.
export function SheetMenuButton({ asChild = false, isActive = false, className, type, ...props }: SheetMenuButtonProps) {
  const Comp = asChild ? Slot.Root : "button";
  return (
    <Comp
      data-slot="sheet-menu-button"
      data-active={isActive}
      type={asChild ? type : (type ?? "button")}
      className={cn(
        "flex min-h-touch-target w-full items-center gap-2 overflow-hidden rounded-md px-2 text-left text-ui text-foreground outline-hidden transition-colors duration-120 hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring active:bg-accent disabled:pointer-events-none disabled:opacity-50 aria-disabled:pointer-events-none aria-disabled:opacity-50 data-[active=true]:bg-accent data-[active=true]:font-medium md:min-h-row-height [&>span:last-child]:truncate [&>svg]:size-4 [&>svg]:shrink-0",
        className,
      )}
      {...props}
    />
  );
}
