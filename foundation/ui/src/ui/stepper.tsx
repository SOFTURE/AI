"use client";

import { formatMessage } from "@softure-ai/core";
import type { ReactNode } from "react";
import type { LinkComponentType } from "./button.js";
import { type ClassNames, createSlotClassGetter, joinClasses } from "./class-names.js";
import { type CopyProps, getCopy } from "./copy.js";
import { CheckIcon } from "./icons.js";
import { useUiLocale } from "./locale.js";

// The steps of a multi-step form: named steps with an icon or a number, the current one marked with
// `aria-current="step"`. Navigation goes back only: a completed step is a link (`href`) or a button
// (`onStepSelect`), the current and the later ones are plain text, so nobody skips a step that was not filled.

export type StepperSlot = "root" | "progress" | "list" | "item" | "connector" | "step" | "marker" | "label";

export type StepState = "done" | "current" | "upcoming";

export interface StepperStep<Id extends string> {
  readonly id: Id;
  readonly label: string;
  /** A decorative icon in the marker; the step's number when omitted. A completed step shows a check. */
  readonly icon?: ReactNode;
  /** Where a completed step leads back to. */
  readonly href?: string;
}

export interface StepperProps<Id extends string> extends CopyProps<"stepper"> {
  readonly steps: readonly StepperStep<Id>[];
  /** The id of the step on screen. */
  readonly current: Id;
  /** The navigation's name for assistive technology ("Sign-up steps"). */
  readonly label: string;
  /** Called with a completed step's id when it has no `href`: the step renders as a button. */
  readonly onStepSelect?: (id: Id) => void;
  /** Renders a completed step's link (for example Next's `Link`); a plain `<a>` when omitted. */
  readonly LinkComponent?: LinkComponentType;
  /** Shows "Step 2 of 4" above the steps. */
  readonly showProgress?: boolean;
  readonly classNames?: ClassNames<StepperSlot>;
  readonly unstyled?: boolean;
}

const STEP_BASE =
  "sft:m-0 sft:inline-flex sft:items-center sft:gap-2 sft:rounded-control sft:border-0 sft:bg-transparent sft:p-1 sft:font-sans sft:text-sm sft:no-underline sft:focus-visible:outline-2 sft:focus-visible:outline-offset-2 sft:focus-visible:outline-focus";

const STEP_LOOK: Readonly<Record<StepState, string>> = {
  done: `${STEP_BASE} sft:cursor-pointer sft:text-foreground sft:hover:underline`,
  current: `${STEP_BASE} sft:font-semibold sft:text-foreground`,
  upcoming: `${STEP_BASE} sft:text-muted`,
};

const MARKER_BASE =
  "sft:inline-flex sft:size-7 sft:shrink-0 sft:items-center sft:justify-center sft:rounded-full sft:border sft:text-xs sft:font-semibold sft:tabular-nums sft:[&>svg]:size-3.5";

const MARKER_LOOK: Readonly<Record<StepState, string>> = {
  done: `${MARKER_BASE} sft:border-accent-fill sft:bg-accent-fill sft:text-on-accent`,
  current: `${MARKER_BASE} sft:border-foreground sft:text-foreground`,
  upcoming: `${MARKER_BASE} sft:border-border-strong sft:text-muted`,
};

function getStepState(index: number, currentIndex: number): StepState {
  if (index < currentIndex) return "done";
  return index === currentIndex ? "current" : "upcoming";
}

/** The steps of a multi-step form, with back-only navigation. */
export function Stepper<Id extends string>({
  steps,
  current,
  label,
  onStepSelect,
  LinkComponent,
  showProgress = false,
  classNames,
  unstyled,
  locale,
  messages,
}: StepperProps<Id>) {
  const copy = getCopy("stepper", { locale: useUiLocale(locale), messages });
  const currentIndex = steps.findIndex((step) => step.id === current);
  const slot = createSlotClassGetter<StepperSlot>({
    defaults: {
      root: "sft:font-sans",
      progress: "sft:mt-0 sft:mb-2 sft:text-xs sft:text-muted",
      list: "sft:m-0 sft:flex sft:list-none sft:items-center sft:gap-2 sft:overflow-x-auto sft:p-0",
      item: "sft:flex sft:shrink-0 sft:items-center sft:gap-2",
      connector: "sft:h-px sft:w-6 sft:shrink-0 sft:bg-border-strong",
      step: "",
      marker: "",
      label: "",
    },
    classNames,
    unstyled,
  });
  return (
    <nav aria-label={label} className={slot("root")}>
      {showProgress && currentIndex !== -1 ? (
        <p className={slot("progress")}>{formatMessage(copy.progress, { current: currentIndex + 1, total: steps.length })}</p>
      ) : null}
      <ol className={slot("list")}>
        {steps.map((step, index) => {
          const state = getStepState(index, currentIndex);
          const look = (part: "step" | "marker", defaults: string) => joinClasses(unstyled === true ? undefined : defaults, slot(part));
          const content = (
            <>
              <span aria-hidden="true" className={look("marker", MARKER_LOOK[state])}>
                {state === "done" ? <CheckIcon /> : (step.icon ?? index + 1)}
              </span>
              <span className={slot("label")}>{step.label}</span>
              {state === "done" ? <span className="sft:sr-only">{copy.completed}</span> : null}
            </>
          );
          const className = look("step", STEP_LOOK[state]);
          let element: ReactNode;
          if (state === "done" && step.href !== undefined) {
            element =
              LinkComponent === undefined ? (
                <a href={step.href} className={className}>
                  {content}
                </a>
              ) : (
                <LinkComponent href={step.href} className={className}>
                  {content}
                </LinkComponent>
              );
          } else if (state === "done" && onStepSelect !== undefined) {
            element = (
              <button type="button" onClick={() => onStepSelect(step.id)} className={className}>
                {content}
              </button>
            );
          } else {
            element = (
              <span aria-current={state === "current" ? "step" : undefined} className={className}>
                {content}
              </span>
            );
          }
          return (
            <li key={step.id} data-state={state} className={slot("item")}>
              {index === 0 ? null : <span aria-hidden="true" className={slot("connector")} />}
              {element}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
