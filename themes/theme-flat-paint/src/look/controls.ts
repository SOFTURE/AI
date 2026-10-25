/**
 * The switch's native input, stretched over the drawing. No `disabled:` variant: the frame shows the unavailable
 * cursor instead.
 */
export const SWITCH_INPUT_LOOK = "peer absolute inset-0 z-10 m-0 size-full cursor-pointer appearance-none rounded-full opacity-0";

/** The switch track: raised surface with a strong line, lime with an accent line when on (the line carries the state). */
export const SWITCH_TRACK_LOOK =
  "pointer-events-none absolute inset-0 rounded-full border border-line-strong bg-surface-raised transition peer-checked:border-accent peer-checked:bg-accent-fill peer-focus-visible:ring-2 peer-focus-visible:ring-accent peer-focus-visible:ring-offset-2 peer-focus-visible:ring-offset-background peer-disabled:opacity-50";

/** The switch knob: muted when off, black on lime when on. */
export const SWITCH_KNOB_LOOK =
  "pointer-events-none absolute left-0.5 top-0.5 flex items-center justify-center rounded-full bg-muted text-transparent transition peer-checked:bg-on-accent peer-checked:text-accent-fill peer-disabled:opacity-60";

/** The slots of `@softure-ai/ui`'s `Checkbox`. */
export type CheckboxSlot = "row" | "box" | "input" | "frame" | "mark" | "label" | "error" | "description";

/**
 * The checkbox in ui's slots (with `unstyled`): an 18 px box with a 5 px radius, lime with a black tick when checked,
 * a `debt` line when invalid. 24 − 3 (inset) + 9 = 30 px: the description and the error start where the label does.
 */
export const CHECKBOX_LOOK: Readonly<Record<CheckboxSlot, string>> = {
  row: "flex items-start gap-[9px]",
  box: "relative -my-0.5 -ml-[3px] inline-flex size-6 shrink-0",
  input: "peer absolute inset-0 z-10 m-0 size-full cursor-pointer appearance-none rounded-[5px] opacity-0",
  frame:
    "pointer-events-none absolute inset-[3px] rounded-[5px] border border-line-strong bg-surface-raised transition peer-checked:border-accent peer-checked:bg-accent-fill peer-aria-invalid:border-debt peer-aria-invalid:ring-1 peer-aria-invalid:ring-debt/40 peer-focus-visible:ring-2 peer-focus-visible:ring-accent peer-focus-visible:ring-offset-2 peer-focus-visible:ring-offset-background",
  mark: "pointer-events-none absolute inset-[3px] flex items-center justify-center text-transparent transition peer-checked:text-on-accent",
  label: "cursor-pointer",
  error: "mt-1.5 pl-[1.875rem] text-sm leading-snug text-debt",
  description: "mt-1 block pl-[1.875rem] text-xs leading-snug text-muted",
};

/** The segmented control's gutter: the page background, a hairline, 4 px inside. */
export const SEGMENTED_GROUP_LOOK =
  "inline-flex min-w-0 max-w-full gap-0.5 overflow-x-auto rounded-lg border border-border bg-background p-1";

const SEGMENT_BASE =
  "inline-flex h-8 shrink-0 cursor-pointer items-center justify-center rounded-md border px-3 text-sm transition";

/**
 * The active segment carries its state three ways at once (surface, strong line, bold), never lime, which has
 * 1.27:1 on white.
 */
export const SEGMENT_ACTIVE_LOOK = `${SEGMENT_BASE} border-line-strong bg-surface font-semibold text-foreground`;

export const SEGMENT_IDLE_LOOK = `${SEGMENT_BASE} border-transparent font-medium text-muted hover:text-foreground`;

/** `SEGMENT_ACTIVE_LOOK` as `data-current:` variants, for ui's `SegmentedNav`, which marks the current link. */
export const SEGMENT_ACTIVE_WHEN_CURRENT_LOOK =
  "data-current:border-line-strong data-current:bg-surface data-current:font-semibold data-current:text-foreground";
