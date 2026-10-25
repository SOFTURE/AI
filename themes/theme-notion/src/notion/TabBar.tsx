import type { ReactNode } from "react";

export interface TabBarItem<Key extends string> {
  // Kept on the link as `data-tab`.
  readonly key: Key;
  readonly label: string;
  readonly href: string;
  // Drawn before the label; the caller hides it from assistive technology.
  readonly icon?: ReactNode;
  // Drawn after the label, 0 included.
  readonly count?: number;
}

export interface TabBarProps<Key extends string> {
  // The nav's accessible name.
  readonly label: string;
  readonly tabs: readonly TabBarItem<Key>[];
  readonly current: Key;
}

// A screen's tabs as line tabs where each tab is a link, so the shown tab lives in the address and survives a reload.
export function TabBar<Key extends string>({ label, tabs, current }: TabBarProps<Key>) {
  return (
    <nav aria-label={label} data-slot="tab-bar" className="overflow-x-auto border-b border-border">
      <ul className="flex gap-1 pb-1">
        {tabs.map((tab) => (
          <li key={tab.key}>
            <a
              href={tab.href}
              className="relative inline-flex h-control-height items-center gap-1.5 rounded-md px-2 text-ui-medium whitespace-nowrap text-muted-foreground transition-colors duration-120 after:absolute after:inset-x-0 after:-bottom-1 after:h-0.5 after:bg-foreground after:opacity-0 hover:bg-accent hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none aria-[current=page]:text-foreground aria-[current=page]:after:opacity-100 [&_svg]:size-4 [&_svg]:shrink-0"
              data-tab={tab.key}
              aria-current={tab.key === current ? "page" : undefined}
            >
              {tab.icon}
              {tab.label}
              {tab.count === undefined ? null : (
                <span data-slot="tab-bar-count" className="rounded-xs bg-accent px-1 text-small text-muted-foreground tabular-nums">
                  {tab.count}
                </span>
              )}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}
