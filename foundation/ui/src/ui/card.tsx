import type { ReactNode } from "react";
import { type ClassNames, createSlotClassGetter } from "./class-names.js";
import type { CopyProps } from "./copy.js";
import { CopyHint } from "./copy-hint.js";

import { CardDisclosure } from "./card-disclosure.js";
import { CheckIcon } from "./icons.js";

// Presentational blocks; server-safe (the hint and the collapsing are client components they render).

export type CardVariant = "boxed" | "flat" | "lead";
export type CardSlot = "root" | "header" | "titleRow" | "title" | "subtitle" | "step" | "accent";
/** The meaning of a card's accent mark: the semantic tokens, `neutral` in the text colour. */
export type CardAccent = "accent" | "success" | "warning" | "danger" | "neutral";
/** `card` is a card's title; `section` is one step larger, for a card that is a section of the screen. */
export type CardHeadingSize = "card" | "section";
export type CardHeadingLevel = 2 | 3 | 4;

export interface CardProps extends CopyProps<"card"> {
  /** Anchor target, so a redirect can bring the user back to this card. */
  readonly id?: string;
  readonly title?: string;
  /** One line of status under the title ("3 of 5 done"), not an explanation. */
  readonly subtitle?: ReactNode;
  /** The explanation behind a "?" next to the title. */
  readonly hint?: ReactNode;
  /** Id of the hint bubble; generated when omitted. */
  readonly hintId?: string;
  /** Pinned to the header's top-right corner, for example the card's own "add" button. Needs a `title`. */
  readonly action?: ReactNode;
  /**
   * `boxed` (default) is a bordered surface; `lead` is the one card a screen is about (more room,
   * same material); `flat` drops border and padding for a card inside another container.
   */
  readonly variant?: CardVariant;
  /** Position in an ordered sequence (setup steps), as a numbered badge before the title. */
  readonly step?: number;
  /** The step is done: the badge shows a tick. Only with `step`. */
  readonly done?: boolean;
  /** A short bar before the title, only where the colour means something. */
  readonly accent?: CardAccent;
  /** The title's element, `h2` by default; the look stays the same (see `headingSize`). */
  readonly headingLevel?: CardHeadingLevel;
  readonly headingSize?: CardHeadingSize;
  /**
   * The content collapses under the header, which becomes the toggle. For a card whose header
   * already carries the answer; needs a `title`. Collapsed content stays mounted.
   */
  readonly collapsible?: boolean;
  /** Open on the first render; only with `collapsible`. */
  readonly defaultOpen?: boolean;
  readonly children?: ReactNode;
  readonly classNames?: ClassNames<CardSlot>;
  readonly unstyled?: boolean;
}

// `min-w-0`: a card is always a grid or flex item, and without it a wide table inside makes the
// card (and the page) overflow even when the table has its own scroll container.
const ROOT: Readonly<Record<CardVariant, string>> = {
  boxed:
    "sft:min-w-0 sft:scroll-mt-4 sft:rounded-card sft:border sft:border-border sft:bg-surface sft:p-5 sft:font-sans sft:text-foreground",
  lead: "sft:min-w-0 sft:scroll-mt-4 sft:rounded-card sft:border sft:border-border sft:bg-surface sft:p-6 sft:font-sans sft:text-foreground",
  flat: "sft:min-w-0 sft:scroll-mt-4 sft:border-t sft:border-border sft:pt-5 sft:font-sans sft:text-foreground sft:first-of-type:border-t-0 sft:first-of-type:pt-0",
};

const CARD_CLASSES: Readonly<Record<Exclude<CardSlot, "root" | "title" | "step" | "accent">, string>> = {
  header: "sft:mb-4 sft:flex sft:items-start sft:justify-between sft:gap-3",
  titleRow: "sft:flex sft:items-center sft:gap-2",
  subtitle: "sft:mt-1 sft:text-sm sft:text-muted",
};

const TITLE: Readonly<Record<CardHeadingSize, string>> = {
  card: "sft:m-0 sft:font-heading sft:text-lg sft:font-bold sft:text-foreground",
  section: "sft:m-0 sft:font-heading sft:text-xl sft:font-bold sft:text-foreground sft:sm:text-2xl",
};

const STEP_BADGE = {
  todo: "sft:flex sft:size-6 sft:shrink-0 sft:items-center sft:justify-center sft:rounded-pill sft:bg-foreground/10 sft:text-xs sft:font-semibold sft:text-muted sft:[&>svg]:size-3.5",
  done: "sft:flex sft:size-6 sft:shrink-0 sft:items-center sft:justify-center sft:rounded-pill sft:bg-success/20 sft:text-xs sft:font-semibold sft:text-success sft:[&>svg]:size-3.5",
} as const;

const ACCENT_BAR: Readonly<Record<CardAccent, string>> = {
  accent: "sft:h-3.5 sft:w-0.75 sft:shrink-0 sft:rounded-pill sft:bg-accent",
  success: "sft:h-3.5 sft:w-0.75 sft:shrink-0 sft:rounded-pill sft:bg-success",
  warning: "sft:h-3.5 sft:w-0.75 sft:shrink-0 sft:rounded-pill sft:bg-warning",
  danger: "sft:h-3.5 sft:w-0.75 sft:shrink-0 sft:rounded-pill sft:bg-danger",
  neutral: "sft:h-3.5 sft:w-0.75 sft:shrink-0 sft:rounded-pill sft:bg-foreground",
};

/** A titled surface: the building block of a dashboard. */
export function Card({
  id,
  title,
  subtitle,
  hint,
  hintId,
  action,
  variant = "boxed",
  step,
  done = false,
  accent,
  headingLevel = 2,
  headingSize = "card",
  collapsible = false,
  defaultOpen = false,
  children,
  classNames,
  unstyled,
  locale,
  messages,
}: CardProps) {
  const slot = createSlotClassGetter<CardSlot>({
    defaults: {
      root: ROOT[variant],
      ...CARD_CLASSES,
      title: TITLE[headingSize],
      step: STEP_BADGE[done ? "done" : "todo"],
      accent: accent === undefined ? "" : ACCENT_BAR[accent],
    },
    classNames,
    unstyled,
  });
  const Heading = `h${headingLevel}` as const;
  const header =
    title === undefined ? null : (
      <header className={slot("header")}>
        <div>
          <div className={slot("titleRow")}>
            {step === undefined ? null : (
              <span aria-hidden="true" data-done={done || undefined} className={slot("step")}>
                {done ? <CheckIcon /> : step}
              </span>
            )}
            {accent === undefined ? null : <span aria-hidden="true" data-accent={accent} className={slot("accent")} />}
            <Heading className={slot("title")}>{title}</Heading>
            {/* Next to the heading, not inside it: the heading's name stays the title alone. */}
            {hint === undefined ? null : (
              <CopyHint group="card" values={{ title }} id={hintId} locale={locale} messages={messages}>
                {hint}
              </CopyHint>
            )}
          </div>
          {subtitle === undefined ? null : <div className={slot("subtitle")}>{subtitle}</div>}
        </div>
        {action}
      </header>
    );
  return (
    <section id={id} className={slot("root")}>
      {collapsible && title !== undefined ? (
        <CardDisclosure title={title} header={header} defaultOpen={defaultOpen} unstyled={unstyled} locale={locale} messages={messages}>
          {children}
        </CardDisclosure>
      ) : (
        <>
          {header}
          {children}
        </>
      )}
    </section>
  );
}

export type StatTone = "default" | "success" | "warning" | "danger" | "muted";
export type StatSize = "md" | "lg";
export type StatSlot = "root" | "label" | "value" | "secondary" | "hint";

export interface StatProps {
  readonly label: string;
  readonly value: string;
  /** A second figure of the same kind, on its own line under the value. */
  readonly secondary?: string;
  /** A small note under the figures. */
  readonly hint?: string;
  readonly tone?: StatTone;
  readonly size?: StatSize;
  readonly classNames?: ClassNames<StatSlot>;
  readonly unstyled?: boolean;
}

const STAT_TONE: Readonly<Record<StatTone, string>> = {
  default: "sft:text-foreground",
  success: "sft:text-success",
  warning: "sft:text-warning",
  danger: "sft:text-danger",
  muted: "sft:text-muted",
};

// Equal-width digits, so the decimal marks of stats side by side line up.
const STAT_VALUE: Readonly<Record<StatSize, string>> = {
  md: "sft:mt-1 sft:break-words sft:text-xl sft:font-semibold sft:tabular-nums sft:sm:text-2xl",
  lg: "sft:mt-1 sft:break-words sft:text-2xl sft:font-semibold sft:tabular-nums sft:sm:text-3xl",
};

/** A headline number with its label. */
export function Stat({ label, value, secondary, hint, tone = "default", size = "md", classNames, unstyled }: StatProps) {
  const slot = createSlotClassGetter<StatSlot>({
    defaults: {
      root: "sft:font-sans",
      label: "sft:text-sm sft:font-medium sft:text-muted",
      value: `${STAT_VALUE[size]} ${STAT_TONE[tone]}`,
      secondary: "sft:mt-0.5 sft:text-sm sft:font-medium sft:tabular-nums sft:text-foreground",
      hint: "sft:mt-1 sft:text-xs sft:text-muted",
    },
    classNames,
    unstyled,
  });
  return (
    <div className={slot("root")}>
      <div className={slot("label")}>{label}</div>
      <div className={slot("value")}>{value}</div>
      {secondary === undefined ? null : <div className={slot("secondary")}>{secondary}</div>}
      {hint === undefined ? null : <div className={slot("hint")}>{hint}</div>}
    </div>
  );
}

export type EmptyStateSlot = "root" | "title" | "description";

export interface EmptyStateProps {
  readonly title: string;
  /** What is missing and how to fill it. */
  readonly children?: ReactNode;
  /** No dashed frame, for an empty state that is the only content of a card. */
  readonly isBare?: boolean;
  readonly classNames?: ClassNames<EmptyStateSlot>;
  readonly unstyled?: boolean;
}

const EMPTY_ROOT = {
  framed: "sft:rounded-control sft:border sft:border-dashed sft:border-border sft:p-4 sft:font-sans",
  bare: "sft:font-sans",
} as const;

/** Shown instead of a result when its inputs are missing. */
export function EmptyState({ title, children, isBare = false, classNames, unstyled }: EmptyStateProps) {
  const slot = createSlotClassGetter<EmptyStateSlot>({
    defaults: {
      root: EMPTY_ROOT[isBare ? "bare" : "framed"],
      title: "sft:m-0 sft:font-medium sft:text-foreground",
      description: "sft:mt-1 sft:mb-0 sft:text-sm sft:text-muted",
    },
    classNames,
    unstyled,
  });
  return (
    <div className={slot("root")}>
      <p className={slot("title")}>{title}</p>
      {children === undefined ? null : <p className={slot("description")}>{children}</p>}
    </div>
  );
}
