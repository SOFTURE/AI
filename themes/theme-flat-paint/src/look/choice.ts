/** The slots of a radio: a 20 px box holding the native input (the drawn circle) and the mark over it. */
export type RadioSlot = "box" | "input" | "mark";

/**
 * The radio control, drawn the way `CHECKBOX_LOOK` and the switch knob are: a strong line on the raised surface, a
 * lime disc with an `accent` line and a black check when checked (the line carries the state, lime alone has 1.27:1
 * on white). The focus is drawn by the choice container around it. Markup:
 * `<span box><input type="radio" input /><span mark aria-hidden><CheckIcon size 12 /></span></span>`.
 */
export const RADIO_LOOK: Readonly<Record<RadioSlot, string>> = {
  box: "relative inline-flex size-5 shrink-0",
  input:
    "peer m-0 size-5 cursor-pointer appearance-none rounded-full border border-line-strong bg-surface-raised transition checked:border-accent checked:bg-accent-fill focus-visible:outline-none",
  mark: "pointer-events-none absolute inset-0 flex scale-0 items-center justify-center text-on-accent transition peer-checked:scale-100",
};

/** The slots of a choice: the `label` wrapping the radio, the radio's place, and the text beside it. */
export type ChoiceSlot = "label" | "control" | "body" | "title" | "description";

/**
 * A choice drawn as a list row: a light wash on hover, a stronger one with the 3 px lime bar when checked, an inset
 * `accent` outline on keyboard focus, the title bold when checked. Markup:
 * `<label label><span control>{radio}</span><span body><span title /><span description /></span></label>`.
 */
export const CHOICE_ROW_LOOK: Readonly<Record<ChoiceSlot, string>> = {
  label:
    "group flex cursor-pointer items-start gap-4 px-2 py-4 transition hover:bg-foreground/[0.03] has-checked:bg-foreground/[0.04] has-checked:shadow-selected-row has-focus-visible:outline-2 has-focus-visible:-outline-offset-2 has-focus-visible:outline-accent sm:px-4",
  control: "mt-0.5 flex shrink-0",
  body: "min-w-0 flex-1",
  title: "block text-foreground group-has-checked:font-bold",
  description: "mt-1 block text-xs leading-snug text-muted",
};

/**
 * A choice drawn as a bordered tile, the radio at the end: a muted line on hover, a foreground line doubled by an
 * inset ring when checked, an `accent` outline on keyboard focus (an outline, so it never fights the checked ring),
 * the title bold when checked. Markup:
 * `<label label><span body><span title /><span description /></span><span control>{radio}</span></label>`.
 */
export const CHOICE_CARD_LOOK: Readonly<Record<ChoiceSlot, string>> = {
  label:
    "group flex cursor-pointer items-start justify-between gap-3 rounded-nested border border-line-strong bg-surface p-4 transition hover:border-muted has-checked:border-foreground has-checked:ring-1 has-checked:ring-inset has-checked:ring-foreground has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-accent",
  control: "flex shrink-0",
  body: "min-w-0 flex-1",
  title: "block text-foreground group-has-checked:font-bold",
  description: "mt-1 block text-xs leading-snug text-muted",
};
