import type { ReactNode } from "react";

import { cn } from "../lib/utils.js";

import { getShare } from "./status.js";

export interface CountryCounterPart {
  /** Unique within the list. */
  readonly key: string;
  readonly label: ReactNode;
  readonly value: number;
}

export interface CountryCounterProps {
  /** The number of countries, counted from the data, never typed in. */
  readonly value: number;
  /** What the bar measures against, `WORLD_COUNTRY_TOTAL` as a rule. */
  readonly total: number;
  /** The unit on the stamp flag, already in the right plural form ("countries"). */
  readonly unit: ReactNode;
  /** The muted line under the flag ("of 195 in the world"). */
  readonly totalLabel: ReactNode;
  /** The whole counter's accessible name ("We have been to 12 countries out of 195"). */
  readonly label: string;
  /** A split under the bar (by continent, the plan), each value in `foreground`. */
  readonly parts?: readonly CountryCounterPart[];
  /** `lg`: the hero step from `md` up, the display step on a phone; `sm`: the display step everywhere. */
  readonly size?: "lg" | "sm";
  readonly className?: string;
}

/**
 * The hero figure of the first screen: one number, the unit on a stamp flag, a bar filled by `scaleX` (never `width`)
 * and an optional split. One per page. The still state is the final state.
 */
export function CountryCounter({ value, total, unit, totalLabel, label, parts, size = "lg", className }: CountryCounterProps) {
  return (
    <div role="group" aria-label={label} data-slot="country-counter" className={cn("grid gap-3 text-foreground", className)}>
      <div className="flex flex-wrap items-end gap-3.5">
        <span data-slot="country-counter-value" className={cn("num font-display text-display tracking-normal", size === "lg" && "md:text-hero")}>
          {value}
        </span>
        <span className="grid gap-1.5 pb-2.5">
          <span className="inline-flex h-unit w-max items-center rounded-tag bg-accent-fill px-2.5 text-unit text-on-accent">{unit}</span>
          <span className="text-body-sm text-muted">{totalLabel}</span>
        </span>
      </div>
      <div aria-hidden="true" className="relative h-1.5 max-w-counter-bar overflow-hidden rounded-pill bg-border">
        <span
          data-slot="country-counter-fill"
          className="absolute inset-0 origin-left rounded-pill bg-accent-fill"
          style={{ transform: `scaleX(${String(getShare(value, total))})` }}
        />
      </div>
      {parts === undefined || parts.length === 0 ? null : (
        <ul className="m-0 flex list-none flex-wrap gap-x-4 gap-y-1.5 p-0 text-label font-normal text-muted">
          {parts.map((part) => (
            <li key={part.key}>
              {part.label} <b className="num font-bold text-foreground">{part.value}</b>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
