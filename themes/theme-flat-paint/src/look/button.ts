/** The button variants of `@softure-ai/ui` (`Button`, `ButtonLink`, `ButtonAnchor`). */
export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger" | "ink" | "ink-outline";
export type IconButtonSize = "sm" | "md" | "lg";
export type IconButtonTone = "neutral" | "danger";

/**
 * Where the Flat Paint button differs from `@softure-ai/ui`'s defaults, per variant; pass it as `className` (only
 * the differences: an app class beats the package's `@layer softure`).
 *
 * - `primary`, `ghost` and `ink` have no border (ui gives them a transparent one, two pixels wider);
 * - hover is 4 % of the text colour on `secondary`, 6 % on `ghost`;
 * - `ink` and `ink-outline` are the primary and secondary action on a white band, where lime has too little
 *   contrast: ink and graphite from the palette, so they stay black in the dark scheme too;
 * - the focus outline takes the variant's colour (`debt`, `graphite`).
 */
export const BUTTON_VARIANT_LOOK: Readonly<Record<ButtonVariant, string>> = {
  primary: "border-0",
  secondary: "not-disabled:hover:bg-foreground/[0.04]",
  ghost: "border-0 not-disabled:hover:bg-foreground/[0.06]",
  danger: "focus-visible:outline-debt/60",
  ink: "border-0 bg-ink text-paper not-disabled:hover:bg-ink-raised focus-visible:outline-graphite/60",
  "ink-outline":
    "border-graphite/45 text-graphite not-disabled:hover:border-graphite not-disabled:hover:bg-graphite/[0.04] focus-visible:outline-graphite/60",
};

/** The icon button's radius per size: `sm` (a table row's target) takes 6 px. */
export const ICON_BUTTON_SIZE_LOOK: Readonly<Record<IconButtonSize, string>> = {
  sm: "rounded-md",
  md: "",
  lg: "",
};

/** The icon button's focus outline: at its edge (icons stand side by side in a row), red for `danger`. */
export const ICON_BUTTON_TONE_LOOK: Readonly<Record<IconButtonTone, string>> = {
  neutral: "focus-visible:outline-offset-0",
  danger: "focus-visible:outline-offset-0 focus-visible:outline-debt/60",
};

/** The Flat Paint look of an icon button of a size and tone, for `IconButton`'s root class. */
export function getIconButtonLook(size: IconButtonSize, tone: IconButtonTone): string {
  return [ICON_BUTTON_SIZE_LOOK[size], ICON_BUTTON_TONE_LOOK[tone]].filter(Boolean).join(" ");
}
