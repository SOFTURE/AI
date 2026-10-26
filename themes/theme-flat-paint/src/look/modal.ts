/** The widths of `@softure-ai/ui`'s `Modal`; `StandingPanel` is always `panel`. */
export type ModalWidth = "form" | "confirmation" | "panel";

/** The slots of `@softure-ai/ui`'s `Modal` and `StandingPanel`. */
export type ModalSlot = "overlay" | "panel" | "header" | "heading" | "title" | "subtitle" | "close";

/** Classes per slot for `classNames`; a slot left out keeps ui's look. */
export type ModalLook = Readonly<Partial<Record<ModalSlot, string>>>;

// The flat veil: ink at 60 %, no blur, fading in (`veil-enter` in `page.css`) instead of ui's opacity transition.
const VEIL = "bg-ink/60 veil-enter transition-none";

// The panel moves by keyframes only: ui's starting-style translate is a transition, which would outrank them.
const PANEL = "shadow-none normal-case transition-none";

const SIDE_PANEL_LOOK: ModalLook = {
  overlay: VEIL,
  panel: `${PANEL} side-panel-enter`,
  header: "items-center",
  title: "text-page",
  close: "rounded-md focus-visible:outline-offset-0",
};

/**
 * Where the Flat Paint dialog differs from ui's `Modal` (`form` and `confirmation`), per slot; pass it as
 * `classNames`. The veil is flat, the panel rises as a bottom sheet on a phone and fades up from 40rem, the title
 * stands on the `page` step.
 */
export const MODAL_LOOK: ModalLook = {
  ...SIDE_PANEL_LOOK,
  panel: `${PANEL} dialog-enter`,
};

/** The Flat Paint look of ui's `StandingPanel` (and of a `Modal` with `width="panel"`): the panel slides in from the right. */
export const STANDING_PANEL_LOOK: ModalLook = SIDE_PANEL_LOOK;

/** The Flat Paint look of a `Modal` of a width, for its `classNames`. */
export function getModalLook(width: ModalWidth): ModalLook {
  return width === "panel" ? STANDING_PANEL_LOOK : MODAL_LOOK;
}
