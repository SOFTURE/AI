import { BUTTON_VARIANT_LOOK } from "./button.js";

/** The slots `@softure-ai/ui`'s `DisclosureMenu`, `AccountMenu` and `MobileMenu` share. */
export type MenuPanelSlot = "root" | "trigger" | "label" | "panel";

/**
 * A menu (`DisclosureMenu`, `AccountMenu`, `MobileMenu`) in ui's `classNames`: the trigger in the Flat Paint ghost
 * button look, and a flat panel (no shadow, 6 px inside) that enters by fading in from 98 % of its size over the slow
 * duration instead of ui's slide. Its 12 px radius is ui's card radius already.
 */
export const MENU_PANEL_LOOK: Readonly<Partial<Record<MenuPanelSlot, string>>> = {
  trigger: BUTTON_VARIANT_LOOK.ghost,
  panel:
    "p-1.5 shadow-none transition-[opacity,scale] duration-(--duration-slow) ease-out-soft translate-y-0 starting:translate-y-0 starting:scale-[0.98] data-[state=closed]:translate-y-0 data-[state=closed]:scale-[0.98]",
};
