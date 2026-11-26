"use client";

import { Ellipsis } from "lucide-react";
import { useCallback, useRef, useState, type MouseEvent, type ReactNode, type Ref } from "react";

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
  /** A stable hook for browser tests, rendered as `data-row-action` on the item. */
  readonly id?: string;
  readonly label: string;
  /** A line icon before the words (the theme's stroke and size apply). */
  readonly icon?: ReactNode;
  readonly onSelect: () => void;
  readonly isDisabled?: boolean;
  /**
   * The action opens the app's own dialog: the menu leaves focus to that dialog when it closes instead of taking it
   * back to its button. Return focus to the button from the dialog's `onCloseAutoFocus` through `triggerRef`.
   */
  readonly opensDialog?: boolean;
}

/** The confirmation a destructive action asks for: the app's own copy. */
export interface RowMenuConfirmation {
  readonly title: ReactNode;
  readonly description?: ReactNode;
  /** The words of the destructive confirm button. */
  readonly confirmLabel: string;
  /** The words of the confirm button while an async action runs ("Deleting…"); `confirmLabel` when not given. */
  readonly pendingLabel?: string;
  /** The words of the button that keeps things as they are. */
  readonly cancelLabel: string;
}

/** The destructive action of a row (delete, revoke): last in the menu, in the danger tone. */
export interface RowMenuDestructiveAction extends Omit<RowMenuAction, "onSelect"> {
  /**
   * What the action does. With `confirm` it may return a promise (a server action): the dialog then stays open with
   * both buttons disabled and `pendingLabel` on the confirm button until it settles, closes when it resolves and stays
   * open when it rejects. The app reports the error itself; the menu only keeps the dialog open.
   */
  readonly onSelect: () => void | Promise<unknown>;
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
  /** Reaches the menu button, so an app's dialog opened from the menu can return focus to it. */
  readonly triggerRef?: Ref<HTMLButtonElement>;
  readonly className?: string;
}

// Below `md` every item is the touch target, as the row's own controls are; a desktop keeps the compact items.
const ITEM_TOUCH_CLASS = "max-md:min-h-touch-target";

function assignRef<T>(ref: Ref<T> | undefined, value: T | null): void {
  if (typeof ref === "function") ref(value);
  else if (ref !== null && ref !== undefined) ref.current = value;
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
  triggerRef,
  className,
}: RowActionsMenuProps) {
  const [isConfirming, setIsConfirming] = useState(false);
  const [isPending, setIsPending] = useState(false);
  const trigger = useRef<HTMLButtonElement | null>(null);
  const isLeavingFocus = useRef(false);
  const confirmation = destructiveAction?.confirm;

  const setTrigger = useCallback(
    (node: HTMLButtonElement | null) => {
      trigger.current = node;
      assignRef(triggerRef, node);
    },
    [triggerRef],
  );

  const selectAction = (action: RowMenuAction) => {
    isLeavingFocus.current = action.opensDialog === true;
    action.onSelect();
  };

  const selectDestructive = () => {
    if (destructiveAction === undefined) return;
    isLeavingFocus.current = false;
    if (confirmation === undefined) {
      // The menu is already closed, so a returned promise is the app's to handle.
      void destructiveAction.onSelect();
      return;
    }
    setIsConfirming(true);
  };

  const confirmDestructive = (event: MouseEvent<HTMLButtonElement>) => {
    if (destructiveAction === undefined) return;
    const result = destructiveAction.onSelect();
    if (!(result instanceof Promise)) return;
    // Keep the dialog open until the action settles.
    event.preventDefault();
    setIsPending(true);
    result.then(
      () => {
        setIsPending(false);
        setIsConfirming(false);
      },
      () => {
        // The app reports its own error; the dialog stays open so the reader can retry or cancel.
        setIsPending(false);
      },
    );
  };

  const changeConfirming = (isOpen: boolean) => {
    if (isPending) return;
    setIsConfirming(isOpen);
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            ref={setTrigger}
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
        <DropdownMenuContent
          align={align}
          onCloseAutoFocus={(event) => {
            // An item that opened the app's dialog leaves focus to that dialog.
            if (!isLeavingFocus.current) return;
            isLeavingFocus.current = false;
            event.preventDefault();
          }}
        >
          {actions.map((action) => (
            <DropdownMenuItem
              key={action.label}
              data-row-action={action.id}
              className={ITEM_TOUCH_CLASS}
              disabled={action.isDisabled}
              onSelect={() => selectAction(action)}
            >
              {action.icon}
              {action.label}
            </DropdownMenuItem>
          ))}
          {destructiveAction !== undefined && actions.length > 0 ? <DropdownMenuSeparator /> : null}
          {destructiveAction !== undefined ? (
            <DropdownMenuItem
              variant="destructive"
              data-row-action={destructiveAction.id}
              className={ITEM_TOUCH_CLASS}
              disabled={destructiveAction.isDisabled}
              onSelect={selectDestructive}
            >
              {destructiveAction.icon}
              {destructiveAction.label}
            </DropdownMenuItem>
          ) : null}
        </DropdownMenuContent>
      </DropdownMenu>
      {confirmation !== undefined && destructiveAction !== undefined ? (
        <AlertDialog open={isConfirming} onOpenChange={changeConfirming}>
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
              <AlertDialogCancel disabled={isPending}>{confirmation.cancelLabel}</AlertDialogCancel>
              <AlertDialogAction
                variant="destructive"
                disabled={isPending}
                aria-busy={isPending || undefined}
                onClick={confirmDestructive}
              >
                {isPending ? (confirmation.pendingLabel ?? confirmation.confirmLabel) : confirmation.confirmLabel}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      ) : null}
    </>
  );
}
