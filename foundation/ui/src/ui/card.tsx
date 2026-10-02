import { formatMessage } from "@softure-ai/core";
import type { ReactNode } from "react";
import { type ClassNames, createSlotClassGetter } from "./class-names.js";
import { type CopyProps, getCopy } from "./copy.js";
import { Hint } from "./hint.js";

// Presentational blocks; server-safe (Hint is a client component they render).
// Ported from FIRE_TRACKER src/components/ui.tsx without its domain props (accent bars, setup steps,
// collapsing).

export type CardVariant = "boxed" | "flat" | "lead";
export type CardSlot = "root" | "header" | "titleRow" | "title" | "subtitle";

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

const CARD_CLASSES: Readonly<Record<Exclude<CardSlot, "root">, string>> = {
  header: "sft:mb-4 sft:flex sft:items-start sft:justify-between sft:gap-3",
  titleRow: "sft:flex sft:items-center sft:gap-2",
  title: "sft:m-0 sft:font-heading sft:text-lg sft:font-bold sft:text-foreground",
  subtitle: "sft:mt-1 sft:text-sm sft:text-muted",
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
  children,
  classNames,
  unstyled,
  locale,
  messages,
}: CardProps) {
  const slot = createSlotClassGetter<CardSlot>({
    defaults: { root: ROOT[variant], ...CARD_CLASSES },
    classNames,
    unstyled,
  });
  const copy = getCopy("card", { locale, messages });
  return (
    <section id={id} className={slot("root")}>
      {title === undefined ? null : (
        <header className={slot("header")}>
          <div>
            <div className={slot("titleRow")}>
              <h2 className={slot("title")}>{title}</h2>
              {/* Next to the heading, not inside it: the heading's name stays the title alone. */}
              {hint === undefined ? null : (
                <Hint label={formatMessage(copy.hintLabel, { title })} id={hintId} anchorLeft>
                  {hint}
                </Hint>
              )}
            </div>
            {subtitle === undefined ? null : <div className={slot("subtitle")}>{subtitle}</div>}
          </div>
          {action}
        </header>
      )}
      {children}
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
