/**
 * The built-in English copy of the components: accessible names a screen reader announces. Every text has a prop to
 * replace it with the app's own wording from its message layer.
 */
export const en = {
  breadcrumb: { label: "breadcrumb", more: "More" },
  dialog: { close: "Close" },
  sheet: { close: "Close" },
  sidePanel: { close: "Close" },
  sidebar: { mobileTitle: "Sidebar", mobileDescription: "Displays the mobile sidebar.", toggle: "Toggle Sidebar" },
  spinner: { label: "Loading" },
  command: { title: "Command Palette", description: "Search for a command to run..." },
} as const;
