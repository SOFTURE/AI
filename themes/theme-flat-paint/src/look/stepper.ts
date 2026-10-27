/** The slots of `@softure-ai/ui`'s `Stepper`. */
export type StepperSlot = "root" | "progress" | "list" | "item" | "connector" | "step" | "marker" | "label";

/**
 * The stepper in ui's `classNames`, by the `data-state` ui sets on each item:
 *
 * - the marker is a 32 px circle (40 px from `sm`): `line-strong` on `background` while upcoming, an `accent` border,
 *   text and 1 px outline 2 px off it when current, `accent-fill` with `on-accent` when done (`accent-fill-hover`
 *   while the step is hovered);
 * - the label is for screen readers only on a phone and bold `foreground` on the current step.
 */
export const STEPPER_LOOK: Readonly<Partial<Record<StepperSlot, string>>> = {
  step: "group/step",
  marker:
    "size-8 border-line-strong bg-background sm:size-10 in-data-[state=current]:border-accent in-data-[state=current]:text-accent in-data-[state=current]:outline in-data-[state=current]:outline-1 in-data-[state=current]:outline-offset-2 in-data-[state=current]:outline-accent in-data-[state=done]:border-accent-fill in-data-[state=done]:bg-accent-fill in-data-[state=done]:text-on-accent in-data-[state=done]:group-hover/step:border-accent-fill-hover in-data-[state=done]:group-hover/step:bg-accent-fill-hover",
  label: "sr-only sm:not-sr-only in-data-[state=current]:font-bold in-data-[state=current]:text-foreground",
};
