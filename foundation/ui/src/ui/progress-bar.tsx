import type { HTMLAttributes, ReactNode } from "react";

import { type ClassNames, createSlotClassGetter } from "./class-names.js";

// Server-safe. Progress bars drawn without a client runtime: `LaunchScreen` streams one before any script runs, and
// `@softure-ai/pwa`'s launch counter moves it through the `data-slot`s and attributes set here.

/** The highest value of every bar: a value is a share in percent. */
const MAX_VALUE = 100;

/** A share between 0 and 100; a non-finite value reads as 0. */
export function clampProgressValue(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(MAX_VALUE, Math.max(0, value));
}

/** The bar's state, as the launch counter and the theme's variants read it. */
export type ProgressBarState = "indeterminate" | "loading" | "complete";

function getProgressState(value: number | undefined): ProgressBarState {
  if (value === undefined) return "indeterminate";
  return value >= MAX_VALUE ? "complete" : "loading";
}

export type ProgressBarSlot = "root" | "indicator";

/** `track`: a 6 px rounded track; `hairline`: 2 px, square, on no track (a loading bar along an edge). */
export type ProgressBarSize = "track" | "hairline";

export interface ProgressBarProps {
  /** 0–100, clamped; left out, a third of the track slides across it (still and faint with reduced motion). */
  readonly value?: number;
  /** The bar's accessible name. */
  readonly label: string;
  /** `track` by default. */
  readonly size?: ProgressBarSize;
  readonly classNames?: ClassNames<ProgressBarSlot>;
  readonly unstyled?: boolean;
}

// Without a value the indicator is a third of the track sliding across it for ever; with reduced motion it stands
// still, full width and faint, so the bar still reads as busy.
const INDETERMINATE =
  "sft:data-[state=indeterminate]:w-1/3 sft:data-[state=indeterminate]:animate-indeterminate sft:motion-reduce:data-[state=indeterminate]:w-full sft:motion-reduce:data-[state=indeterminate]:animate-none sft:motion-reduce:data-[state=indeterminate]:opacity-50";

const PROGRESS_BAR_SIZE: Readonly<Record<ProgressBarSize, string>> = {
  track: "sft:h-1.5 sft:rounded-pill sft:bg-foreground/10",
  hairline: "sft:h-0.5 sft:rounded-none sft:bg-transparent",
};

// No width: the bar is a block and takes its container's, so a width of the caller's never competes with one here.
const PROGRESS_BAR_CLASSES: Readonly<Record<ProgressBarSlot, string>> = {
  root: "sft:relative sft:block sft:overflow-hidden",
  indicator: `sft:block sft:h-full sft:w-full sft:bg-accent sft:transition-transform sft:duration-(--sft-duration-base) sft:ease-(--sft-ease-out) ${INDETERMINATE}`,
};

/**
 * A thin progress bar (`role="progressbar"`, 0–100). The indicator is full width and moves by `translateX`, so a
 * value never animates the width. `data-slot="progress"` and `progress-indicator` are the hooks of the pwa counter.
 */
export function ProgressBar({ value, label, size = "track", classNames, unstyled }: ProgressBarProps) {
  const share = value === undefined ? undefined : clampProgressValue(value);
  const state = getProgressState(share);
  const defaults = { ...PROGRESS_BAR_CLASSES, root: `${PROGRESS_BAR_CLASSES.root} ${PROGRESS_BAR_SIZE[size]}` };
  const slot = createSlotClassGetter({ defaults, classNames, unstyled });
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={MAX_VALUE}
      aria-valuenow={share}
      data-slot="progress"
      data-size={size}
      data-state={state}
      data-value={share}
      data-max={MAX_VALUE}
      className={slot("root")}
    >
      <div
        data-slot="progress-indicator"
        data-state={state}
        className={slot("indicator")}
        style={share === undefined ? undefined : { transform: `translateX(-${MAX_VALUE - share}%)` }}
      />
    </div>
  );
}

/** The meaning a `MiniProgress` fill carries; left out, the accent. */
export type MiniProgressTone = "success" | "warning" | "danger";

export type MiniProgressSlot = "root" | "indicator" | "label" | "labelOnFill";

export type MiniProgressProps = Omit<HTMLAttributes<HTMLDivElement>, "children" | "className" | "role"> & {
  /** 0–100, clamped; a non-finite value reads as 0. */
  readonly value: number;
  /** Text inside the bar, e.g. a formatted amount; the rounded percent when left out. */
  readonly label?: ReactNode;
  readonly tone?: MiniProgressTone;
  readonly classNames?: ClassNames<MiniProgressSlot>;
  readonly unstyled?: boolean;
};

// The fill and the colour of the label copy drawn on it, per tone: on-accent on the accent fill, the page
// background on a meaning colour.
const MINI_FILL: Readonly<Record<MiniProgressTone | "accent", { fill: string; text: string }>> = {
  accent: { fill: "sft:bg-accent-fill", text: "sft:text-on-accent" },
  success: { fill: "sft:bg-success", text: "sft:text-background" },
  warning: { fill: "sft:bg-warning", text: "sft:text-background" },
  danger: { fill: "sft:bg-danger", text: "sft:text-background" },
};

const MINI_LABEL =
  "sft:absolute sft:inset-0 sft:flex sft:items-center sft:px-2 sft:font-sans sft:text-xs sft:font-medium sft:tabular-nums sft:whitespace-nowrap";

function getMiniProgressClasses(tone: MiniProgressTone | undefined): Readonly<Record<MiniProgressSlot, string>> {
  const look = MINI_FILL[tone ?? "accent"];
  return {
    root: "sft:relative sft:block sft:h-5 sft:w-full sft:min-w-16 sft:overflow-hidden sft:rounded-control sft:bg-foreground/10",
    indicator: `sft:absolute sft:inset-y-0 sft:left-0 ${look.fill}`,
    label: `${MINI_LABEL} sft:text-foreground`,
    labelOnFill: `${MINI_LABEL} ${look.text}`,
  };
}

/**
 * A share with its figure inside the bar, for a table cell or a tile: a 20 px track that takes the cell's width and
 * carries the label, so a figure and a bar never collide in a narrow column. The label is drawn twice, in the text
 * colour on the track and in the fill's text colour clipped to the fill, so it reads at any value. Both copies are
 * hidden from screen readers: the bar reports the value (and a string label as its value text). A label wider than
 * the cell ends in an ellipsis.
 */
export function MiniProgress({ value, label, tone, classNames, unstyled, ...rest }: MiniProgressProps) {
  const share = clampProgressValue(value);
  const text = label ?? `${Math.round(share)}%`;
  const slot = createSlotClassGetter({ defaults: getMiniProgressClasses(tone), classNames, unstyled });
  const truncate = unstyled === true ? undefined : "sft:truncate";
  return (
    <div
      {...rest}
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={MAX_VALUE}
      aria-valuenow={share}
      aria-valuetext={typeof text === "string" ? text : undefined}
      data-slot="mini-progress"
      data-tone={tone ?? "default"}
      className={slot("root")}
    >
      <div data-slot="mini-progress-indicator" className={slot("indicator")} style={{ width: `${share}%` }} />
      <span aria-hidden="true" data-slot="mini-progress-label" className={slot("label")}>
        <span className={truncate}>{text}</span>
      </span>
      <span
        aria-hidden="true"
        data-slot="mini-progress-label"
        className={slot("labelOnFill")}
        style={{ clipPath: `inset(0 ${MAX_VALUE - share}% 0 0)` }}
      >
        <span className={truncate}>{text}</span>
      </span>
    </div>
  );
}
