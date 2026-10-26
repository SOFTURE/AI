import type { ReactNode } from "react";

import { en as messages } from "../messages/en.js";
import { cn } from "../lib/utils.js";

export type StepState = "done" | "current" | "todo" | "failed";

export interface StepItem {
  // Kept on the step as `data-step`.
  readonly key: string;
  readonly title: string;
  readonly note?: ReactNode;
  // Defaults to `todo`.
  readonly state?: StepState;
  // Drawn at the step's end, e.g. a tag naming the service the step uses.
  readonly aside?: ReactNode;
}

// `row`: a wrapping grid of cards; `list`: a compact vertical list.
export type StepsLayout = "row" | "list";

export interface StepsProps {
  // The list's accessible name.
  readonly label: string;
  readonly steps: readonly StepItem[];
  readonly layout?: StepsLayout;
  // Each state's word for assistive technology, from the app's message layer.
  readonly stateLabels?: Partial<Readonly<Record<StepState, string>>>;
}

// Literal class names per state, so Tailwind generates each one (the theme's `@source` covers this folder).
const STEP_NUMBER_STATE: Readonly<Record<StepState, string>> = {
  done: "bg-green-tag text-green-tag-foreground",
  current: "bg-primary text-primary-foreground",
  todo: "bg-muted text-muted-foreground",
  failed: "bg-red-tag text-red-tag-foreground",
};

const STEPS_LIST: Readonly<Record<StepsLayout, string>> = {
  row: "grid grid-cols-[repeat(auto-fill,minmax(min(12rem,100%),1fr))] gap-2",
  list: "flex flex-col",
};

const STEP_ITEM: Readonly<Record<StepsLayout, string>> = {
  row: "flex min-w-0 items-start gap-2 rounded-lg bg-card p-3 text-card-foreground shadow-card data-[state=current]:bg-blue-bg",
  list: "flex min-w-0 items-start gap-2 rounded-md px-2 py-1.5 transition-colors duration-120 hover:bg-accent",
};

const STEP_NUMBER_SHAPE: Readonly<Record<StepsLayout, string>> = {
  row: "rounded-full",
  list: "rounded-sm",
};

// An ordered process: each step's number in a badge coloured by its state, its title, an optional note under it and
// an optional aside at its end. The state is also a word for assistive technology, so it never reads by colour alone.
export function Steps({ label, steps, layout = "row", stateLabels }: StepsProps) {
  const words = { ...messages.steps, ...stateLabels };
  return (
    <ol aria-label={label} data-slot="steps" data-layout={layout} className={STEPS_LIST[layout]}>
      {steps.map((step, index) => {
        const state = step.state ?? "todo";
        return (
          <li
            key={step.key}
            data-step={step.key}
            data-state={state}
            aria-current={state === "current" ? "step" : undefined}
            className={STEP_ITEM[layout]}
          >
            <span
              aria-hidden="true"
              data-slot="step-number"
              className={cn(
                "mt-px flex size-5 shrink-0 items-center justify-center text-small font-medium tabular-nums",
                STEP_NUMBER_SHAPE[layout],
                STEP_NUMBER_STATE[state],
              )}
            >
              {index + 1}
            </span>
            <div className="min-w-0 flex-1">
              <div className="text-sm font-medium">
                {step.title}
                <span className="sr-only">, {words[state]}</span>
              </div>
              {step.note === undefined ? null : (
                <div data-slot="step-note" className="mt-0.5 text-small text-muted-foreground">
                  {step.note}
                </div>
              )}
            </div>
            {step.aside === undefined ? null : (
              <div data-slot="step-aside" className="shrink-0">
                {step.aside}
              </div>
            )}
          </li>
        );
      })}
    </ol>
  );
}
