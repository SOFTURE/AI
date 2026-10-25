/** The card variants of `@softure-ai/ui`'s `Card`. */
export type CardVariant = "boxed" | "lead" | "flat";
/** How high a card's title stands: a card in a panel, or a card that is a section of the screen. */
export type CardHeading = "card" | "section";
export type StatSize = "md" | "lg";

/** The card's root per variant: a `flat` card inside another card has a fainter seam than a frame. */
export const CARD_ROOT_LOOK: Readonly<Record<CardVariant, string | undefined>> = {
  boxed: undefined,
  lead: undefined,
  flat: "border-border/60",
};

/** The card title on the type scale: `subsection` on every card, `band` from `sm` on a card that is a section. */
export const CARD_TITLE_LOOK: Readonly<Record<CardHeading, string>> = {
  card: "text-subsection",
  section: "text-subsection sm:text-band",
};

/** The setup step badge: the raised surface, green once the step is done (`data-done`, set by ui). */
export const CARD_STEP_LOOK = "bg-surface-raised data-done:bg-accessible/20 data-done:text-accessible";

/** A `Stat` figure in the text face with even digits (`figure`), one step larger than ui's at `lg`. */
export const STAT_VALUE_LOOK: Readonly<Record<StatSize, string>> = {
  md: "figure",
  lg: "figure sm:text-4xl",
};

/** A `Stat`'s second amount, in the same face as its figure. */
export const STAT_SECONDARY_LOOK = "figure";

/** A field label: one style for every label, a sentence at 85 % of the text colour. */
export const FIELD_LABEL_LOOK = "text-sm font-medium text-foreground/85";
