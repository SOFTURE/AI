"use client";

import { Progress as ProgressPrimitive } from "radix-ui";
import type { ComponentProps, ReactNode } from "react";

import { cn } from "../lib/utils.js";

import { TONE_FILL, type Tone } from "./tones.js";

export type MiniProgressProps = Omit<ComponentProps<typeof ProgressPrimitive.Root>, "children" | "max" | "value"> & {
  /** 0–100, clamped; non-finite values read as 0. */
  readonly value: number;
  /** Text inside the bar, e.g. a formatted amount; defaults to the rounded percent. */
  readonly label?: ReactNode;
  /** Fill colour by meaning (the theme's tones); defaults to primary. */
  readonly tone?: Tone;
};

function clampShare(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(100, Math.max(0, value));
}

const LABEL_CLASS = "absolute inset-0 flex items-center px-2 text-xs font-medium tabular-nums whitespace-nowrap";

// A share with its figure inside the bar, for a table cell or a tile: a 20 px track that takes the cell's width and
// carries the label, so a figure and a bar never collide in a narrow column. The label is drawn twice: in the text
// colour on the track, and in the page background clipped to the fill, so it reads at any value, also where the
// fill's edge crosses a letter. Both copies are hidden: the progress bar itself reports the value (and a string label
// as its value text). A label wider than the cell ends in an ellipsis.
export function MiniProgress({ value, label, tone, className, ...props }: MiniProgressProps) {
  const share = clampShare(value);
  const text = label ?? `${Math.round(share)}%`;
  return (
    <ProgressPrimitive.Root
      data-slot="mini-progress"
      data-tone={tone ?? "default"}
      value={share}
      max={100}
      getValueLabel={typeof text === "string" ? () => text : undefined}
      className={cn("relative h-5 w-full min-w-16 overflow-hidden rounded-sm bg-primary/12", className)}
      {...props}
    >
      <ProgressPrimitive.Indicator
        data-slot="mini-progress-indicator"
        className={cn(
          "absolute inset-y-0 left-0 transition-[width]",
          // In dark the default fill is the lighter link blue, as in `Progress`.
          tone === undefined ? "bg-primary dark:bg-link" : TONE_FILL[tone],
        )}
        style={{ width: `${share}%` }}
      />
      <span aria-hidden="true" data-slot="mini-progress-label" className={cn(LABEL_CLASS, "text-foreground")}>
        <span className="truncate">{text}</span>
      </span>
      {/* The page background, not `primary-foreground`: white on the dark fills stays under 4.5:1. */}
      <span
        aria-hidden="true"
        data-slot="mini-progress-label"
        className={cn(LABEL_CLASS, "text-background")}
        style={{ clipPath: `inset(0 ${100 - share}% 0 0)` }}
      >
        <span className="truncate">{text}</span>
      </span>
    </ProgressPrimitive.Root>
  );
}
