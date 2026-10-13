"use client";

import type { ReactNode } from "react";
import type { LinkComponentType } from "./button.js";
import { type ClassNames, createSlotClassGetter } from "./class-names.js";
import { type CopyProps, getCopy } from "./copy.js";
import { DisclosureMenu, type DisclosureMenuAlign, type DisclosureMenuSlot, type UseDisclosureOptions } from "./disclosure-menu.js";
import { MenuIcon, UserIcon } from "./icons.js";
import { useUiCopyProps } from "./locale.js";

// The two menus of an app's top bar, on top of `DisclosureMenu` (Escape, an outside press, a link click and a new
// `closeKey` close them). Their trigger names come from the `appShell` messages.

export type AccountMenuSlot = DisclosureMenuSlot | "identity" | "name" | "email" | "footer";

export interface AccountMenuProps extends CopyProps<"appShell">, Pick<UseDisclosureOptions, "closeKey" | "closeOutsideOn"> {
  /** The signed-in user's name, at the top of the panel. */
  readonly name?: string;
  readonly email?: string;
  /** The panel's links (settings, billing). */
  readonly children?: ReactNode;
  /** Under the links, after a divider: the sign-out form. */
  readonly footer?: ReactNode;
  /** Shows the trigger's name next to the icon; the icon alone by default. */
  readonly isLabelShown?: boolean;
  readonly align?: DisclosureMenuAlign;
  readonly classNames?: ClassNames<AccountMenuSlot>;
  readonly unstyled?: boolean;
}

/** The user menu: who is signed in, the account's links and the sign-out. */
export function AccountMenu({
  name,
  email,
  children,
  footer,
  isLabelShown = false,
  align = "end",
  closeKey,
  closeOutsideOn,
  classNames,
  unstyled,
  locale,
  messages,
}: AccountMenuProps) {
  const copy = getCopy("appShell", useUiCopyProps("appShell", { locale, messages }));
  const slot = createSlotClassGetter<"identity" | "name" | "email" | "footer">({
    defaults: {
      identity: "sft:flex sft:flex-col sft:gap-0.5 sft:border-b sft:border-border sft:px-3 sft:pt-2 sft:pb-2.5 sft:mb-1",
      name: "sft:m-0 sft:truncate sft:text-sm sft:font-semibold sft:text-foreground",
      email: "sft:m-0 sft:truncate sft:text-xs sft:text-muted",
      footer: "sft:mt-1 sft:border-t sft:border-border sft:pt-1",
    },
    classNames,
    unstyled,
  });
  const hasIdentity = name !== undefined || email !== undefined;
  return (
    <DisclosureMenu
      label={copy.accountMenu}
      icon={<UserIcon />}
      isLabelHidden={!isLabelShown}
      align={align}
      closeKey={closeKey}
      closeOutsideOn={closeOutsideOn}
      classNames={classNames}
      unstyled={unstyled}
    >
      {hasIdentity ? (
        <div className={slot("identity")}>
          {name === undefined ? null : <p className={slot("name")}>{name}</p>}
          {email === undefined ? null : <p className={slot("email")}>{email}</p>}
        </div>
      ) : null}
      {children}
      {footer === undefined ? null : <div className={slot("footer")}>{footer}</div>}
    </DisclosureMenu>
  );
}

export interface MobileMenuItem {
  readonly href: string;
  readonly label: string;
  /** The page on screen: `aria-current="page"`. */
  readonly isCurrent?: boolean;
}

export type MobileMenuSlot = DisclosureMenuSlot | "nav" | "list" | "item" | "link";

export interface MobileMenuProps extends CopyProps<"appShell">, Pick<UseDisclosureOptions, "closeKey" | "closeOutsideOn"> {
  readonly items: readonly MobileMenuItem[];
  /** Renders each link (for example Next's `Link`); a plain `<a>` when omitted. */
  readonly LinkComponent?: LinkComponentType;
  /** More content under the links (a theme switch, a sign-out). */
  readonly children?: ReactNode;
  readonly align?: DisclosureMenuAlign;
  readonly classNames?: ClassNames<MobileMenuSlot>;
  readonly unstyled?: boolean;
}

/** The phone navigation: a menu button that shows the app's main links. */
export function MobileMenu({
  items,
  LinkComponent,
  children,
  align = "end",
  closeKey,
  closeOutsideOn,
  classNames,
  unstyled,
  locale,
  messages,
}: MobileMenuProps) {
  const copy = getCopy("appShell", useUiCopyProps("appShell", { locale, messages }));
  const slot = createSlotClassGetter<"nav" | "list" | "item" | "link">({
    defaults: {
      nav: "",
      list: "sft:m-0 sft:flex sft:list-none sft:flex-col sft:gap-0.5 sft:p-0",
      item: "",
      link: "sft:aria-[current=page]:bg-foreground/5 sft:aria-[current=page]:font-semibold",
    },
    classNames,
    unstyled,
  });
  return (
    <DisclosureMenu
      label={copy.mobileMenu}
      icon={<MenuIcon />}
      isLabelHidden
      align={align}
      closeKey={closeKey}
      closeOutsideOn={closeOutsideOn}
      classNames={classNames}
      unstyled={unstyled}
    >
      <nav aria-label={copy.mobileMenu} className={slot("nav")}>
        <ul className={slot("list")}>
          {items.map((item) => {
            const props = { href: item.href, "aria-current": item.isCurrent === true ? ("page" as const) : undefined, className: slot("link") };
            return (
              <li key={item.href} className={slot("item")}>
                {LinkComponent === undefined ? <a {...props}>{item.label}</a> : <LinkComponent {...props}>{item.label}</LinkComponent>}
              </li>
            );
          })}
        </ul>
      </nav>
      {children}
    </DisclosureMenu>
  );
}
