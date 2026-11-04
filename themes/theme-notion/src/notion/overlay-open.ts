// Kept out of the "use client" AsidePanel module so a Server Component or a plain script can call it too.

// Overlays that handle Escape themselves: a Radix dialog, menu, listbox or popover while it is open, a native modal.
const OPEN_OVERLAY_SELECTORS = [
  '[role="dialog"][data-state="open"]',
  '[role="alertdialog"][data-state="open"]',
  '[role="menu"][data-state="open"]',
  '[role="listbox"][data-state="open"]',
  "dialog[open]",
  ":popover-open",
] as const;

function hasMatch(root: ParentNode, selector: string): boolean {
  try {
    return root.querySelector(selector) !== null;
  } catch {
    // A DOM that does not know the selector (`:popover-open` in an older engine) has no such overlay open.
    return false;
  }
}

/**
 * Whether a dialog, menu, listbox or popover is open under `root`: one with Radix `data-state="open"`, one that
 * matches `:popover-open`, or a `dialog[open]`. A closed popover that stays in the page with `role="dialog"` does
 * not count. A keyboard handler reads it before acting on Escape, so the overlay closes first.
 */
export function isOverlayOpen(root: ParentNode): boolean {
  return OPEN_OVERLAY_SELECTORS.some((selector) => hasMatch(root, selector));
}
