"use client";

import { formatMessage } from "@softure-ai/core";
import { type ChangeEvent, type InvalidEvent, type ReactNode, useId } from "react";
import { type ClassNames, createSlotClassGetter } from "./class-names.js";
import { type CopyProps, getCopy } from "./copy.js";
import { Hint } from "./hint.js";
import { CheckIcon } from "./icons.js";

// Native checkboxes drawn by the product. Ported from FIRE_TRACKER src/components/switch.tsx.
// The input stays a real, hittable checkbox laid over the drawing (`peer`), so the state comes from
// `:checked`, form data is native ("on" when checked), and keyboard and labels work as usual.

export type SwitchSize = "sm" | "md";
export type SwitchControlSlot = "root" | "input" | "track" | "knob";

const TRACK_SIZE: Readonly<Record<SwitchSize, string>> = { sm: "sft:h-5 sft:w-9", md: "sft:h-6 sft:w-11" };
const KNOB_SIZE: Readonly<Record<SwitchSize, string>> = {
  sm: "sft:size-4 sft:peer-checked:translate-x-4",
  md: "sft:size-5 sft:peer-checked:translate-x-5",
};

const SWITCH_CONTROL_CLASSES: Readonly<Record<Exclude<SwitchControlSlot, "root">, string>> = {
  input:
    "sft:peer sft:absolute sft:inset-0 sft:z-10 sft:m-0 sft:size-full sft:cursor-pointer sft:appearance-none sft:rounded-full sft:opacity-0 sft:disabled:cursor-not-allowed",
  track:
    "sft:pointer-events-none sft:absolute sft:inset-0 sft:rounded-full sft:border sft:border-border-strong sft:bg-surface-raised sft:transition-colors sft:duration-(--sft-duration-fast) sft:peer-checked:border-accent-fill sft:peer-checked:bg-accent-fill sft:peer-focus-visible:outline-2 sft:peer-focus-visible:outline-offset-2 sft:peer-focus-visible:outline-focus sft:peer-disabled:opacity-50",
  knob: "sft:pointer-events-none sft:absolute sft:left-0.5 sft:top-0.5 sft:flex sft:items-center sft:justify-center sft:rounded-full sft:bg-muted sft:text-transparent sft:transition sft:duration-(--sft-duration-fast) sft:ease-(--sft-ease-out) sft:peer-checked:bg-on-accent sft:peer-checked:text-accent-fill sft:peer-disabled:opacity-60 sft:motion-reduce:transition-none",
};

export interface SwitchControlProps {
  readonly name?: string;
  readonly id?: string;
  readonly value?: string;
  readonly checked?: boolean;
  readonly defaultChecked?: boolean;
  readonly onChange?: (checked: boolean) => void;
  readonly disabled?: boolean;
  readonly size?: SwitchSize;
  /** For a switch that reveals a panel. */
  readonly "aria-expanded"?: boolean;
  readonly "aria-controls"?: string;
  readonly "aria-describedby"?: string;
  /** The name when there is no visible label. */
  readonly "aria-label"?: string;
  readonly classNames?: ClassNames<SwitchControlSlot>;
  readonly unstyled?: boolean;
}

/** The bare switch: a native checkbox with `role="switch"`, no label. */
export function SwitchControl({
  name,
  id,
  value,
  checked,
  defaultChecked,
  onChange,
  disabled,
  size = "md",
  classNames,
  unstyled,
  ...aria
}: SwitchControlProps) {
  const slot = createSlotClassGetter<SwitchControlSlot>({
    defaults: {
      root: `sft:relative sft:inline-flex sft:shrink-0 ${TRACK_SIZE[size]}`,
      ...SWITCH_CONTROL_CLASSES,
      knob: `${SWITCH_CONTROL_CLASSES.knob} ${KNOB_SIZE[size]}`,
    },
    classNames,
    unstyled,
  });
  return (
    <span className={slot("root")}>
      <input
        {...aria}
        id={id}
        type="checkbox"
        role="switch"
        name={name}
        value={value}
        checked={checked}
        defaultChecked={defaultChecked}
        onChange={onChange === undefined ? undefined : (event) => onChange(event.target.checked)}
        disabled={disabled}
        className={slot("input")}
      />
      <span aria-hidden="true" className={slot("track")} />
      <span aria-hidden="true" className={slot("knob")}>
        <CheckIcon size={size === "md" ? 12 : 10} />
      </span>
    </span>
  );
}

export type SwitchSlot = "root" | "control" | "text" | "labelRow" | "label" | "state" | "description";
export type SwitchVariant = "field" | "bare";

export interface SwitchProps
  extends Omit<SwitchControlProps, "aria-describedby" | "aria-label" | "classNames" | "unstyled">,
    CopyProps<"field"> {
  readonly label: ReactNode;
  /** Explanation behind a "?" next to the label. */
  readonly hint?: ReactNode;
  /** Name of the "?"; by default the field hint label with a string `label`. */
  readonly hintLabel?: string;
  /** A line under the label, tied to the switch with `aria-describedby`. */
  readonly description?: ReactNode;
  /** A line that follows the state; both lines are in the markup and `:checked` picks the visible one. */
  readonly stateText?: { readonly on: ReactNode; readonly off: ReactNode };
  /** `field` (default) frames the switch like an input; `bare` has no frame. */
  readonly variant?: SwitchVariant;
  readonly classNames?: ClassNames<SwitchSlot>;
  readonly controlClassNames?: ClassNames<SwitchControlSlot>;
  readonly unstyled?: boolean;
}

const SWITCH_FRAME: Readonly<Record<SwitchVariant, string>> = {
  field:
    "sft:group/switch sft:flex sft:min-h-10 sft:items-start sft:gap-3 sft:rounded-control sft:border sft:border-border sft:bg-surface sft:px-3 sft:py-1.5 sft:font-sans sft:transition-colors sft:duration-(--sft-duration-fast) sft:has-checked:border-accent/40 sft:has-disabled:opacity-70",
  bare: "sft:group/switch sft:flex sft:items-start sft:gap-3 sft:font-sans",
};

const SWITCH_CLASSES: Readonly<Record<Exclude<SwitchSlot, "root">, string>> = {
  control: "sft:flex sft:pt-px",
  text: "sft:min-w-0 sft:flex-1",
  labelRow: "sft:flex sft:items-baseline sft:gap-1.5",
  label:
    "sft:cursor-pointer sft:text-sm sft:font-medium sft:leading-normal sft:text-foreground sft:group-has-disabled/switch:cursor-not-allowed",
  state: "sft:grid sft:text-xs sft:leading-snug sft:text-muted",
  description: "sft:mt-0.5 sft:block sft:text-xs sft:leading-snug sft:text-muted",
};

const STATE_ON = "sft:invisible sft:col-start-1 sft:row-start-1 sft:group-has-checked/switch:visible";
const STATE_OFF = "sft:visible sft:col-start-1 sft:row-start-1 sft:group-has-checked/switch:invisible";

/** A labelled switch for a yes/no setting. */
export function Switch({
  name,
  id,
  label,
  hint,
  hintLabel,
  description,
  stateText,
  variant = "field",
  size = "md",
  classNames,
  controlClassNames,
  unstyled,
  locale,
  messages,
  ...control
}: SwitchProps) {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  const descriptionId = `${inputId}-description`;
  const slot = createSlotClassGetter<SwitchSlot>({
    defaults: { root: SWITCH_FRAME[variant], ...SWITCH_CLASSES },
    classNames,
    unstyled,
  });
  const copy = getCopy("field", { locale, messages });
  const triggerLabel = hintLabel ?? formatMessage(copy.hintLabel, { label: typeof label === "string" ? label : "" });
  return (
    <div className={slot("root")}>
      <span className={slot("control")}>
        <SwitchControl
          {...control}
          name={name}
          id={inputId}
          size={size}
          aria-describedby={description === undefined ? undefined : descriptionId}
          classNames={controlClassNames}
          unstyled={unstyled}
        />
      </span>
      <span className={slot("text")}>
        <span className={slot("labelRow")}>
          <label htmlFor={inputId} className={slot("label")}>
            {label}
          </label>
          {hint === undefined ? null : (
            <Hint label={triggerLabel} id={`${inputId}-hint`} anchorLeft>
              {hint}
            </Hint>
          )}
        </span>
        {stateText === undefined ? null : (
          <span className={slot("state")}>
            <span className={unstyled === true ? undefined : STATE_ON}>{stateText.on}</span>
            <span className={unstyled === true ? undefined : STATE_OFF}>{stateText.off}</span>
          </span>
        )}
        {description === undefined ? null : (
          <span id={descriptionId} className={slot("description")}>
            {description}
          </span>
        )}
      </span>
    </div>
  );
}

export type CheckboxSlot = "root" | "row" | "box" | "input" | "frame" | "mark" | "label" | "error" | "description";

export interface CheckboxProps {
  readonly name: string;
  readonly id?: string;
  /** The statement the user agrees to; may contain links. */
  readonly label: ReactNode;
  readonly required?: boolean;
  readonly defaultChecked?: boolean;
  readonly checked?: boolean;
  readonly disabled?: boolean;
  /** The error under the checkbox; sets `aria-invalid`. */
  readonly error?: string;
  readonly description?: ReactNode;
  readonly onInvalid?: (event: InvalidEvent<HTMLInputElement>) => void;
  readonly onChange?: (event: ChangeEvent<HTMLInputElement>) => void;
  readonly classNames?: ClassNames<CheckboxSlot>;
  readonly unstyled?: boolean;
}

// A 24 px target: the input fills the `size-6` box and the drawing is inset inside it.
const CHECKBOX_CLASSES: Readonly<Record<CheckboxSlot, string>> = {
  root: "sft:font-sans",
  row: "sft:flex sft:items-start sft:gap-2",
  box: "sft:relative sft:-my-0.5 sft:inline-flex sft:size-6 sft:shrink-0",
  input:
    "sft:peer sft:absolute sft:inset-0 sft:z-10 sft:m-0 sft:size-full sft:cursor-pointer sft:appearance-none sft:opacity-0 sft:disabled:cursor-not-allowed",
  frame:
    "sft:pointer-events-none sft:absolute sft:inset-0.5 sft:rounded-control sft:border sft:border-border-strong sft:bg-surface-raised sft:transition-colors sft:duration-(--sft-duration-fast) sft:peer-checked:border-accent-fill sft:peer-checked:bg-accent-fill sft:peer-aria-invalid:border-danger sft:peer-aria-invalid:ring-1 sft:peer-aria-invalid:ring-danger/40 sft:peer-focus-visible:outline-2 sft:peer-focus-visible:outline-offset-2 sft:peer-focus-visible:outline-focus sft:peer-disabled:opacity-50",
  mark: "sft:pointer-events-none sft:absolute sft:inset-0.5 sft:flex sft:items-center sft:justify-center sft:text-transparent sft:peer-checked:text-on-accent",
  label: "sft:cursor-pointer sft:text-sm sft:text-foreground",
  error: "sft:mt-1.5 sft:mb-0 sft:pl-8 sft:text-sm sft:leading-snug sft:text-danger",
  description: "sft:mt-1 sft:block sft:pl-8 sft:text-xs sft:leading-snug sft:text-muted",
};

/** A checkbox for a statement (consent, confirmation); a setting is a `Switch`. */
export function Checkbox({
  name,
  id,
  label,
  required,
  defaultChecked,
  checked,
  disabled,
  error,
  description,
  onInvalid,
  onChange,
  classNames,
  unstyled,
}: CheckboxProps) {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  const errorId = `${inputId}-error`;
  const descriptionId = `${inputId}-description`;
  const hasError = error !== undefined && error !== "";
  const describedBy = [hasError ? errorId : undefined, description === undefined ? undefined : descriptionId].filter(
    (part) => part !== undefined,
  );
  const slot = createSlotClassGetter({ defaults: CHECKBOX_CLASSES, classNames, unstyled });
  return (
    <div className={slot("root")}>
      <div className={slot("row")}>
        <span className={slot("box")}>
          <input
            id={inputId}
            type="checkbox"
            name={name}
            required={required}
            defaultChecked={defaultChecked}
            checked={checked}
            disabled={disabled}
            onInvalid={onInvalid}
            onChange={onChange}
            aria-invalid={hasError || undefined}
            aria-describedby={describedBy.length === 0 ? undefined : describedBy.join(" ")}
            className={slot("input")}
          />
          <span aria-hidden="true" className={slot("frame")} />
          <span aria-hidden="true" className={slot("mark")}>
            <CheckIcon size={12} />
          </span>
        </span>
        <label htmlFor={inputId} className={slot("label")}>
          {label}
        </label>
      </div>
      {hasError ? (
        <p id={errorId} className={slot("error")}>
          {error}
        </p>
      ) : null}
      {description === undefined ? null : (
        <span id={descriptionId} className={slot("description")}>
          {description}
        </span>
      )}
    </div>
  );
}
