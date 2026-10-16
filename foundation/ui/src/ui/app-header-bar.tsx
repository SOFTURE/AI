import type { ReactNode } from "react";
import { type ClassNames, createSlotClassGetter } from "./class-names.js";

// Server-safe: the sticky bar at the top of a signed-in app. The brand on the left, the main navigation from
// `md` up, the actions (an `AccountMenu`) on the right and, below `md`, the phone menu (a `MobileMenu`).

export type AppHeaderBarSlot = "root" | "inner" | "brand" | "nav" | "actions" | "mobileMenu";

export interface AppHeaderBarProps {
  /** The logo or the app's name, usually a link to the start page. */
  readonly brand: ReactNode;
  /** The main navigation, shown from `md` up (a `<nav>` with its own `aria-label`). */
  readonly nav?: ReactNode;
  /** The right-hand actions: an `AccountMenu`, a `ThemeSwitch`. */
  readonly actions?: ReactNode;
  /** The phone navigation (a `MobileMenu`), shown below `md` after the actions. */
  readonly mobileMenu?: ReactNode;
  /** Sticks to the top while the page scrolls; `true` by default. */
  readonly isSticky?: boolean;
  readonly classNames?: ClassNames<AppHeaderBarSlot>;
  readonly unstyled?: boolean;
}

const POSITION = { sticky: "sft:sticky sft:top-0 sft:z-30", static: "sft:relative" } as const;

/** The app's top bar: brand, navigation, actions and the phone menu. */
export function AppHeaderBar({ brand, nav, actions, mobileMenu, isSticky = true, classNames, unstyled }: AppHeaderBarProps) {
  const slot = createSlotClassGetter<AppHeaderBarSlot>({
    defaults: {
      root: `${POSITION[isSticky ? "sticky" : "static"]} sft:border-b sft:border-border sft:bg-surface sft:font-sans sft:text-foreground`,
      inner: "sft:mx-auto sft:box-border sft:flex sft:h-14 sft:w-full sft:items-center sft:gap-4 sft:px-4",
      brand: "sft:flex sft:shrink-0 sft:items-center sft:gap-2",
      nav: "sft:hidden sft:min-w-0 sft:flex-1 sft:items-center sft:gap-1 sft:md:flex",
      actions: "sft:ml-auto sft:flex sft:items-center sft:gap-2",
      mobileMenu: "sft:md:hidden",
    },
    classNames,
    unstyled,
  });
  return (
    <header data-sticky={isSticky ? "" : undefined} className={slot("root")}>
      <div className={slot("inner")}>
        <div className={slot("brand")}>{brand}</div>
        {nav === undefined ? null : <div className={slot("nav")}>{nav}</div>}
        <div className={slot("actions")}>
          {actions}
          {mobileMenu === undefined ? null : <div className={slot("mobileMenu")}>{mobileMenu}</div>}
        </div>
      </div>
    </header>
  );
}
