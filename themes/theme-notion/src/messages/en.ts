/**
 * The built-in English copy of the components: accessible names a screen reader announces. Every text has a prop to
 * replace it with the app's own wording from its message layer.
 */
export const en = {
  breadcrumb: { label: "breadcrumb", more: "More" },
  dialog: { close: "Close" },
  filterChip: { add: "Add filter" },
  sheet: { close: "Close" },
  sidePanel: { close: "Close" },
  sidebar: { mobileTitle: "Sidebar", mobileDescription: "Displays the mobile sidebar.", toggle: "Toggle Sidebar" },
  spinner: { label: "Loading" },
  sortable: {
    instructions:
      "To pick up a row, press Space or Enter. Use the arrow keys to move it, then press Space or Enter to drop it, or Escape to cancel.",
    pickedUp: "Picked up {item}, position {position} of {total}.",
    moved: "{item} moved to position {position} of {total}.",
    dropped: "Dropped {item} at position {position} of {total}.",
    cancelled: "Cancelled. {item} is back in place.",
    handle: "Drag to reorder",
  },
  steps: { done: "Done", current: "Current", todo: "To do", failed: "Failed" },
  command: { title: "Command Palette", description: "Search for a command to run..." },
} as const;
