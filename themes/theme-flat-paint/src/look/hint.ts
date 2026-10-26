/** The slots of `@softure-ai/ui`'s `Hint`. */
export type HintSlot = "root" | "trigger" | "bubble";

/** The props of ui's `HintAppearance` the Flat Paint hint sets: spread it on `Hint` (`<Hint {...HINT_LOOK}>`). */
export interface HintLook {
  readonly classNames: Readonly<Partial<Record<HintSlot, string>>>;
  readonly triggerGap: number;
}

/**
 * The hint: a 10 px glyph in the trigger with the `accent` focus ring instead of ui's outline, a 6 px bubble radius
 * and 8 px between the trigger and the bubble.
 */
export const HINT_LOOK: HintLook = {
  classNames: {
    trigger: "text-[10px] transition focus:outline-none focus-visible:ring-2 focus-visible:ring-accent",
    bubble: "rounded-md",
  },
  triggerGap: 8,
};
