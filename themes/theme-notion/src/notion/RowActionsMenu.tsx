"use client";

import { Ellipsis } from "lucide-react";
import { useRef, useState, type ReactNode } from "react";

import { cn } from "../lib/utils.js";
import { en as messages } from "../messages/en.js";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "../ui/alert-dialog.js";
import { Button } from "../ui/button.js";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "../ui/dropdown-menu.js";

import { ICON_STROKE_WIDTH } from "./icon-stroke.js";

/** One secondary action of a row: its words, an optional icon, and what it does. */
export interface RowMenuAction {
  readonly label: string;
  /** A line icon before the words (the theme's stroke and size apply). */
  readonly icon?: ReactNode;
  readonly onSelect: () => void;
  readonly isDisabled?: boolean;
}

/** The confirmation a destructive action asks for: the app's own copy. */
export interface RowMenuConfirmation {
  readonly title: ReactNode;
  readonly description?: ReactNode;
  /** The words of the destructive confirm button. */
  readonly confirmLabel: string;
  /** The words of the button that keeps things as they are. */
  readonly cancelLabel: string;
}

/** The destructive action of a row (delete, revoke): last in the menu, in the danger tone. */
export interface RowMenuDestructiveAction extends RowMenuAction {
  /** Ask first: the action runs only after the alert dialog's confirm button. Without it the action runs at once. */
  readonly confirm?: RowMenuConfirmation;
}

export interface RowActionsMenuProps {
  /** The secondary actions, in the order they are listed. */
  readonly actions?: readonly RowMenuAction[];
  /** The destructive action, always last, after a separator. */
  readonly destructiveAction?: RowMenuDestructiveAction;
  /** The button's accessible name; the English default is "More actions". */
  readonly label?: string;
  /** The menu's edge against the button; `end` (the row's right edge) by default. */
  readonly align?: "start" | "center" | "end";
  readonly className?: string;
}

/**
 * A row's overflow menu: an icon-only "More actions" button that opens a menu of the row's secondary actions, the
 * destructive one last, after a separator and in the danger tone, optionally confirmed in an alert dialog. Opens with
 * Enter, Space or ArrowDown; the arrow keys move between items. Place it in `ListEntry`'s `menu` slot, next to the
 * row's one inline control.
 */
export function RowActionsMenu({
  actions = [],
  destructiveAction,
  label = messages.rowActions.more,
  align = "end",
  className,
}: RowActionsMenuProps) {
  const [isConfirming, setIsConfirming] = useState(false);
  const trigger = useRef<HTMLButtonElement>(null);
  const confirmation = destructiveAction?.confirm;

  const selectDestructive = () => {
    if (destructiveAction === undefined) return;
    if (confirmation === undefined) {
      destructiveAction.onSelect();
      return;
    }
    setIsConfirming(true);
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            ref={trigger}
            data-slot="row-actions-menu-trigger"
            type="button"
            variant="ghost"
            size="icon"
            aria-label={label}
            className={cn("text-muted-foreground", className)}
          >
            <Ellipsis strokeWidth={ICON_STROKE_WIDTH} aria-hidden="true" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align={align}>
          {actions.map((action) => (
            <DropdownMenuItem key={action.label} disabled={action.isDisabled} onSelect={action.onSelect}>
              {action.icon}
              {action.label}
            </DropdownMenuItem>
          ))}
          {destructiveAction !== undefined && actions.length > 0 ? <DropdownMenuSeparator /> : null}
          {destructiveAction !== undefined ? (
            <DropdownMenuItem variant="destructive" disabled={destructiveAction.isDisabled} onSelect={selectDestructive}>
              {destructiveAction.icon}
              {destructiveAction.label}
            </DropdownMenuItem>
          ) : null}
        </DropdownMenuContent>
      </DropdownMenu>
      {confirmation !== undefined && destructiveAction !== undefined ? (
        <AlertDialog open={isConfirming} onOpenChange={setIsConfirming}>
          <AlertDialogContent
            size="sm"
            onCloseAutoFocus={(event) => {
              // The menu item that opened the dialog is gone: focus goes back to the menu button.
              event.preventDefault();
              trigger.current?.focus();
            }}
          >
            <AlertDialogHeader>
              <AlertDialogTitle>{confirmation.title}</AlertDialogTitle>
              {confirmation.description !== undefined ? (
                <AlertDialogDescription>{confirmation.description}</AlertDialogDescription>
              ) : null}
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>{confirmation.cancelLabel}</AlertDialogCancel>
              <AlertDialogAction variant="destructive" onClick={destructiveAction.onSelect}>
                {confirmation.confirmLabel}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      ) : null}
    </>
  );
}
