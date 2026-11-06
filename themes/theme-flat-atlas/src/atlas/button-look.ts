/** A button's size: it alone sets the height, padding, text and icon size, so two buttons of one size line up. */
export type ButtonSize = "sm" | "md" | "lg";

/** A button's variant: it alone sets the colours. */
export type ButtonVariant = "primary" | "secondary" | "ghost" | "ink";

const BUTTON_BASE_LOOK =
  "inline-flex shrink-0 cursor-pointer items-center justify-center gap-2 whitespace-nowrap rounded-control border border-transparent font-sans no-underline transition-[background-color,border-color,color,transform] active:not-disabled:scale-97 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:cursor-not-allowed disabled:opacity-50 [&_svg]:shrink-0";

/** Height, padding, text and icon size by size: 32, 40 and 52 px. */
export const BUTTON_SIZE_LOOK: Readonly<Record<ButtonSize, string>> = {
  sm: "h-control-sm px-3 text-button-sm [&_svg]:size-3.5",
  md: "h-control-md px-4 text-label [&_svg]:size-4",
  lg: "h-control-lg px-6 text-button-lg [&_svg]:size-4.5",
};

/**
 * Colours by variant. `primary` is the stamp ink with white, at most one per screen; `secondary` an outline in
 * `line-strong`; `ghost` muted text; `ink` the quieter main action beside a painted map.
 */
export const BUTTON_VARIANT_LOOK: Readonly<Record<ButtonVariant, string>> = {
  primary: "bg-accent-fill text-on-accent hover:not-disabled:bg-accent-fill-hover",
  secondary: "border-line-strong font-medium text-foreground hover:not-disabled:border-foreground hover:not-disabled:bg-foreground/5",
  ghost: "font-medium text-muted hover:not-disabled:bg-foreground/7 hover:not-disabled:text-foreground",
  ink: "bg-ink text-paper hover:not-disabled:bg-ink-muted",
};

/** The whole class string of a button, for an element that is not a `<button>` (a link, a router link). */
export function getButtonLook(size: ButtonSize, variant: ButtonVariant): string {
  return `${BUTTON_BASE_LOOK} ${BUTTON_SIZE_LOOK[size]} ${BUTTON_VARIANT_LOOK[variant]}`;
}

/** A 40 px square button that carries only an icon; its name comes from `aria-label`. */
export const ICON_BUTTON_LOOK =
  "inline-flex size-control-md shrink-0 cursor-pointer items-center justify-center rounded-control border border-transparent text-muted transition-colors hover:bg-surface-raised hover:text-foreground focus-visible:outline-2 focus-visible:outline-accent [&_svg]:size-4.5";

/** The outline an icon button takes when it stands alone (a menu button in the header). */
export const ICON_BUTTON_BORDERED_LOOK = "border-line-strong";

/** The wordmark beside the logo: Raleway capitals at 0.1em, the mark at 44 px, a link to the home page. */
export const WORDMARK_LOOK =
  "inline-flex items-center gap-2.5 font-sans text-wordmark uppercase text-foreground no-underline [&_img]:size-mark [&_img]:shrink-0 [&_svg]:size-mark [&_svg]:shrink-0";
