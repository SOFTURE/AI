"use client";

import { useId } from "react";
import { type ClassNames, createSlotClassGetter } from "./class-names.js";

// A native radio group drawn as segments: arrow keys move the choice, form data is native.
// Ported from FIRE_TRACKER src/components/switch.tsx (SegmentedControl) and FD-5's theme switch.

export type SegmentedControlSlot = "root" | "legend" | "options" | "option" | "input" | "label";

export interface SegmentedOption<Value extends string> {
  readonly value: Value;
  readonly label: string;
}

export interface SegmentedControlProps<Value extends string> {
  readonly options: readonly SegmentedOption<Value>[];
  readonly value: Value;
  readonly onChange: (value: Value) => void;
  /** The group's name for assistive technology, and its visible title unless `isLegendHidden`. */
  readonly legend: string;
  readonly isLegendHidden?: boolean;
  /** Form field name; generated when omitted. */
  readonly name?: string;
  readonly classNames?: ClassNames<SegmentedControlSlot>;
  readonly unstyled?: boolean;
}

const DEFAULT_CLASSES: Readonly<Record<SegmentedControlSlot, string>> = {
  root: "sft:m-0 sft:min-w-0 sft:border-0 sft:p-0 sft:font-sans sft:text-foreground",
  legend: "sft:mb-2 sft:p-0 sft:text-sm sft:font-semibold",
  options:
    "sft:inline-flex sft:max-w-full sft:gap-1 sft:overflow-x-auto sft:rounded-control sft:border sft:border-border sft:bg-surface sft:p-1",
  option:
    "sft:relative sft:shrink-0 sft:cursor-pointer sft:rounded-control sft:px-3 sft:py-1 sft:text-sm sft:text-muted sft:transition-colors sft:duration-(--sft-duration-fast) sft:ease-(--sft-ease-out) sft:hover:text-foreground sft:has-checked:bg-accent-fill sft:has-checked:text-on-accent sft:has-focus-visible:outline-2 sft:has-focus-visible:outline-offset-2 sft:has-focus-visible:outline-focus",
  input: "sft:sr-only",
  label: "sft:font-medium",
};

const HIDDEN_LEGEND = "sft:sr-only";

/** One choice out of a few, all visible at once. */
export function SegmentedControl<Value extends string>({
  options,
  value,
  onChange,
  legend,
  isLegendHidden = false,
  name,
  classNames,
  unstyled,
}: SegmentedControlProps<Value>) {
  const generatedName = useId();
  const slot = createSlotClassGetter({
    defaults: { ...DEFAULT_CLASSES, legend: isLegendHidden ? HIDDEN_LEGEND : DEFAULT_CLASSES.legend },
    classNames,
    unstyled,
  });
  return (
    <fieldset className={slot("root")}>
      <legend className={slot("legend")}>{legend}</legend>
      <div className={slot("options")}>
        {options.map((option) => (
          <label key={option.value} className={slot("option")}>
            <input
              type="radio"
              className={slot("input")}
              name={name ?? generatedName}
              value={option.value}
              checked={option.value === value}
              onChange={() => onChange(option.value)}
            />
            <span className={slot("label")}>{option.label}</span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}
