import type { ReactNode } from "react";

// Panels for a tab bar the page draws elsewhere as links (the active tab comes from the route). Server-safe. Only the
// active panel renders, so an inactive panel's server components do not even run; `isAlwaysMounted` keeps a panel in
// the tree, hidden, so what the user typed in it survives a switch and back. Keys and order are stable (`id`, the
// order of `panels`), or React would remount the hidden panel on every switch. No `role="tabpanel"`: without
// `role="tab"` elements pointing at it the role would be orphaned. `data-tab-panel` is a hook for tests and styles.

export interface TabPanel<Id extends string> {
  readonly id: Id;
  readonly content: ReactNode;
  /** Render this panel on every tab, hidden when inactive, so its state survives a switch. */
  readonly isAlwaysMounted?: boolean;
  readonly className?: string;
}

export interface TabPanelsProps<Id extends string> {
  readonly active: Id;
  readonly panels: readonly TabPanel<Id>[];
}

/** The active panel, plus the always-mounted ones hidden. */
export function TabPanels<Id extends string>({ active, panels }: TabPanelsProps<Id>) {
  return (
    <>
      {panels
        .filter((panel) => panel.id === active || panel.isAlwaysMounted === true)
        .map((panel) => (
          <div key={panel.id} data-tab-panel={panel.id} hidden={panel.id !== active} className={panel.className}>
            {panel.content}
          </div>
        ))}
    </>
  );
}
