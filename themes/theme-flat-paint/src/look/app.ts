/** The slots of `@softure-ai/ui`'s `UpdatePrompt` (and the frame `InstallBar` shares). */
export type AppPromptSlot = "root" | "panel" | "icon" | "title" | "body" | "description" | "action";

/** The slots of `@softure-ai/ui`'s `InstallBar`. */
export type InstallBarSlot = AppPromptSlot | "steps" | "step" | "close";

/** The slots of `@softure-ai/ui`'s `LaunchScreen`. */
export type LaunchScreenSlot = "root" | "icon" | "name" | "bar" | "indicator" | "percent";

/** The slots of `@softure-ai/ui`'s `MiniProgress`. */
export type MiniProgressSlot = "root" | "indicator" | "label" | "labelOnFill";

// The prompt panel: flat on `surface-raised` with ui's hairline (the bridge already makes ui's shadow a zero one),
// rising into place on the motion tokens (`prompt-enter` in `page.css`), the title on the `subsection` step, the
// description on `body-sm` in `muted`, the primary action without ui's transparent border.
const PROMPT_LOOK: Readonly<Partial<Record<AppPromptSlot, string>>> = {
  panel: "shadow-none prompt-enter",
  icon: "text-accent",
  // `font-bold` too: ui's `font-semibold` sets the weight variable the type step reads.
  title: "text-subsection font-bold",
  body: "text-body-sm",
  action: "border-0",
};

/**
 * Where the Flat Paint update prompt differs from ui's `UpdatePrompt`, per slot; pass it as `classNames`. The reload
 * button is the screen's one `primary`: lime paint with black `on-accent` text through the bridge.
 */
export const UPDATE_PROMPT_LOOK: Readonly<Partial<Record<AppPromptSlot, string>>> = PROMPT_LOOK;

/**
 * Where the Flat Paint install bar differs from ui's `InstallBar`, per slot: the prompt's look, the iOS steps in the
 * text colour on `body-sm`, and the close button with the `accent` focus ring at its edge.
 */
export const INSTALL_BAR_LOOK: Readonly<Partial<Record<InstallBarSlot, string>>> = {
  ...PROMPT_LOOK,
  steps: "text-body-sm",
  close: "focus-visible:outline-offset-0",
};

/**
 * Where the Flat Paint launch screen differs from ui's `LaunchScreen`, per slot: the icon on the card radius, the
 * app's name on the `band` step, the bar on a `border` track, the percentage as a `num` in `muted`. The indicator
 * keeps ui's `accent`, never lime: in the light scheme lime is paint, not a line (1.27:1 on white). ui's
 * `TopLoadingBar` needs no map for the same reason: its 2 px line is `accent` on no track.
 */
export const LAUNCH_SCREEN_LOOK: Readonly<Partial<Record<LaunchScreenSlot, string>>> = {
  icon: "rounded-card",
  name: "text-band font-bold",
  bar: "bg-border",
  percent: "num text-muted",
};

/** Both screens of ui's `RouteLoading` in the Flat Paint look: `<RouteLoading classNames={ROUTE_LOADING_LOOK} … />`. */
export const ROUTE_LOADING_LOOK = {
  launchScreen: LAUNCH_SCREEN_LOOK,
} as const;

/**
 * Where the Flat Paint mini progress differs from ui's `MiniProgress`, per slot: the flag radius, a track on the text
 * colour at 8 %, the label as a `num` on the `caption` step. The default fill stays ui's lime with black text (paint
 * carrying its figure); a tone takes the theme's meaning colours through the bridge.
 */
export const MINI_PROGRESS_LOOK: Readonly<Partial<Record<MiniProgressSlot, string>>> = {
  root: "rounded-flag bg-foreground/[0.08]",
  label: "num text-caption",
  labelOnFill: "num text-caption",
};
