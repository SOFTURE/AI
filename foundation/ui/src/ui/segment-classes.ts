// The segmented look as plain classes, server-safe (no "use client"), for an app's own segments:
// buttons with `aria-pressed` or the links of a view picker. `SegmentedControl` (a radio group)
// marks its chosen option with `has-checked`; other elements take one class per state.

/** The frame around a row of segments. */
export const SEGMENTED_GROUP_CLASS =
  "sft:inline-flex sft:max-w-full sft:gap-1 sft:overflow-x-auto sft:rounded-control sft:border sft:border-border sft:bg-surface sft:p-1";

const SEGMENT_BASE =
  "sft:relative sft:m-0 sft:shrink-0 sft:cursor-pointer sft:rounded-control sft:border-0 sft:px-3 sft:py-1 sft:font-sans sft:text-sm sft:font-medium sft:no-underline sft:transition-colors sft:duration-(--sft-duration-fast) sft:ease-(--sft-ease-out) sft:focus-visible:outline-2 sft:focus-visible:outline-offset-2 sft:focus-visible:outline-focus";

/** The chosen segment: the accent fill plus an inset ring in the text colour, a cue that does not rely on colour. */
export const SEGMENT_ACTIVE_CLASS = `${SEGMENT_BASE} sft:bg-accent-fill sft:text-on-accent sft:ring-1 sft:ring-inset sft:ring-foreground`;

/** A segment not chosen. */
export const SEGMENT_IDLE_CLASS = `${SEGMENT_BASE} sft:bg-transparent sft:text-muted sft:hover:text-foreground`;
