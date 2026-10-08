import type { LinkComponentType } from "./button.js";
import { type ClassNames, createSlotClassGetter } from "./class-names.js";
import { SEGMENT_ACTIVE_CLASS, SEGMENT_IDLE_CLASS, SEGMENTED_GROUP_CLASS } from "./segment-classes.js";

// The segmented look over links: a view switcher that changes the route (a path or a query parameter), so the choice
// survives a reload and "back" and works without JavaScript. Server-safe. The current link carries `aria-current`,
// not `aria-selected`: these are links in a `<nav>`, not tabs.

export type SegmentedNavSlot = "root" | "link";

export interface SegmentedNavItem<Id extends string> {
  readonly id: Id;
  readonly href: string;
  readonly label: string;
}

export interface SegmentedNavProps<Id extends string> {
  readonly items: readonly SegmentedNavItem<Id>[];
  /** The id of the view on screen. */
  readonly current: Id;
  /** The navigation's name for assistive technology; two on one page must differ. */
  readonly label: string;
  /** Renders each link (for example Next's `Link`); a plain `<a>` when omitted. */
  readonly LinkComponent?: LinkComponentType;
  /** The `aria-current` value of the current link; `page` by default. */
  readonly ariaCurrent?: "page" | "location" | "true";
  readonly classNames?: ClassNames<SegmentedNavSlot>;
  readonly unstyled?: boolean;
}

/** Links drawn as segments, one of them current. */
export function SegmentedNav<Id extends string>({
  items,
  current,
  label,
  LinkComponent,
  ariaCurrent = "page",
  classNames,
  unstyled,
}: SegmentedNavProps<Id>) {
  const slot = createSlotClassGetter({ defaults: { root: SEGMENTED_GROUP_CLASS, link: "" }, classNames, unstyled });
  return (
    <nav aria-label={label} className={slot("root")}>
      {items.map((item) => {
        const isCurrent = item.id === current;
        const look = unstyled === true ? undefined : isCurrent ? SEGMENT_ACTIVE_CLASS : SEGMENT_IDLE_CLASS;
        const className = [look, slot("link")].filter(Boolean).join(" ");
        const props = {
          href: item.href,
          "aria-current": isCurrent ? ariaCurrent : undefined,
          "data-current": isCurrent ? "" : undefined,
          className: className === "" ? undefined : className,
        };
        return LinkComponent === undefined ? (
          <a key={item.id} {...props}>
            {item.label}
          </a>
        ) : (
          <LinkComponent key={item.id} {...props}>
            {item.label}
          </LinkComponent>
        );
      })}
    </nav>
  );
}
