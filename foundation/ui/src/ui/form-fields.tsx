"use client";

import { type ReactNode, useId } from "react";
import { normalizeAmountInput } from "./amount.js";
import { type ClassNames, createSlotClassGetter } from "./class-names.js";
import type { CopyProps } from "./copy.js";
import {
  Field,
  type FieldSlot,
  getDescribedBy,
  type HintPlacement,
  INPUT_CLASS,
  NUMBER_INPUT_CLASS,
  SUFFIX_PADDING_CLASS,
} from "./field.js";
import { getCheckedAfterSubmit, useFieldError, useFieldValue, useSubmitCount, useSubmittedFieldNames } from "./form-context.js";
import { Select, type SelectOption, type SelectSlot } from "./select.js";
import { Checkbox, Switch } from "./switch.js";

// Labelled form fields. Inside an `ActionForm` they replay the values of a rejected submit and show
// its field errors; outside one they are plain uncontrolled fields. Ported from FIRE_TRACKER
// src/components/form-fields.tsx (domain fields dropped).

export type InputFieldSlot = FieldSlot | "input" | "suffixWrap" | "suffix";

/** What every labelled field takes. */
export interface BaseFieldProps extends CopyProps<"field"> {
  readonly name: string;
  readonly label: string;
  /** Control id; generated when omitted (a name may repeat on a page, an id may not). */
  readonly id?: string;
  readonly hint?: string;
  readonly hintAs?: HintPlacement;
  /** An error to show now; else the error the last `ActionForm` submit returned for `name`. */
  readonly error?: string;
  readonly required?: boolean;
  readonly classNames?: ClassNames<InputFieldSlot>;
  readonly unstyled?: boolean;
}

interface FieldIds {
  readonly inputId: string;
  readonly hintId: string;
  readonly errorId: string | undefined;
  readonly shownError: string | undefined;
  readonly describedBy: string | undefined;
}

/** Ids and the error of one field: the explicit error wins over the replayed one. */
function useFieldIds({ id, name, error, hint, hintAs }: Pick<BaseFieldProps, "id" | "name" | "error" | "hint" | "hintAs">): FieldIds {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  const replayedError = useFieldError(name);
  const shownError = error !== undefined && error !== "" ? error : replayedError;
  const errorId = shownError === undefined || shownError === "" ? undefined : `${inputId}-error`;
  const hintId = `${inputId}-hint`;
  return {
    inputId,
    hintId,
    errorId,
    shownError,
    describedBy: getDescribedBy({ errorId, hintId, hasBlockHint: hint !== undefined && hintAs !== "tooltip" }),
  };
}

function pickFieldSlots(classNames: ClassNames<InputFieldSlot> | undefined): ClassNames<FieldSlot> | undefined {
  if (classNames === undefined) return undefined;
  const { root, labelRow, label, error, hint } = classNames;
  return { root, labelRow, label, error, hint };
}

const SUFFIX_CLASSES = {
  suffixWrap: "sft:relative sft:block",
  suffix:
    "sft:pointer-events-none sft:absolute sft:inset-y-0 sft:right-3 sft:flex sft:items-center sft:font-sans sft:text-sm sft:text-muted",
} as const;

function WithSuffix({
  suffix,
  slot,
  children,
}: {
  suffix: string | undefined;
  slot: (part: "suffixWrap" | "suffix") => string | undefined;
  children: ReactNode;
}) {
  if (suffix === undefined) return children;
  return (
    <span className={slot("suffixWrap")}>
      {children}
      <span aria-hidden="true" className={slot("suffix")}>
        {suffix}
      </span>
    </span>
  );
}

export interface TextFieldProps extends BaseFieldProps {
  readonly defaultValue?: string;
  /** Caller copy shown in the empty field. */
  readonly placeholder?: string;
  /** A numeric keyboard; also switches the input to equal-width digits. */
  readonly inputMode?: "decimal" | "numeric";
  readonly type?: "text" | "email" | "date" | "tel" | "url";
  readonly autoComplete?: string;
  readonly maxLength?: number;
  /** A unit drawn inside the field's right edge ("kg", "%"). */
  readonly suffix?: string;
}

/** A labelled text input. */
export function TextField({
  name,
  label,
  id,
  hint,
  hintAs,
  error,
  required = false,
  defaultValue = "",
  placeholder,
  inputMode,
  type = "text",
  autoComplete,
  maxLength,
  suffix,
  classNames,
  unstyled,
  locale,
  messages,
}: TextFieldProps) {
  const value = useFieldValue(name, defaultValue);
  const ids = useFieldIds({ id, name, error, hint, hintAs });
  const base = inputMode === undefined ? INPUT_CLASS : NUMBER_INPUT_CLASS;
  const slot = createSlotClassGetter<"input" | "suffixWrap" | "suffix">({
    defaults: { input: suffix === undefined ? base : `${base} ${SUFFIX_PADDING_CLASS}`, ...SUFFIX_CLASSES },
    classNames,
    unstyled,
  });
  return (
    <Field
      label={label}
      fieldId={ids.inputId}
      hint={hint}
      hintAs={hintAs}
      hintId={ids.hintId}
      error={ids.shownError}
      errorId={ids.errorId}
      classNames={pickFieldSlots(classNames)}
      unstyled={unstyled}
      locale={locale}
      messages={messages}
    >
      <WithSuffix suffix={suffix} slot={slot}>
        <input
          // A new key remounts the uncontrolled input when a rejected submit replays another value.
          key={value}
          id={ids.inputId}
          type={type}
          name={name}
          required={required}
          placeholder={placeholder}
          inputMode={inputMode}
          autoComplete={autoComplete}
          maxLength={maxLength}
          defaultValue={value}
          aria-invalid={ids.errorId === undefined ? undefined : true}
          aria-describedby={ids.describedBy}
          className={slot("input")}
        />
      </WithSuffix>
    </Field>
  );
}

export interface PasswordFieldProps extends Omit<BaseFieldProps, "required"> {
  readonly minLength?: number;
  /** `current-password` or `new-password`. */
  readonly autoComplete?: string;
}

/** A required password input. It takes no default value and never replays a submitted password. */
export function PasswordField({
  name,
  label,
  id,
  hint,
  hintAs,
  error,
  minLength,
  autoComplete,
  classNames,
  unstyled,
  locale,
  messages,
}: PasswordFieldProps) {
  const ids = useFieldIds({ id, name, error, hint, hintAs });
  const slot = createSlotClassGetter<"input">({ defaults: { input: INPUT_CLASS }, classNames, unstyled });
  return (
    <Field
      label={label}
      fieldId={ids.inputId}
      hint={hint}
      hintAs={hintAs}
      hintId={ids.hintId}
      error={ids.shownError}
      errorId={ids.errorId}
      classNames={pickFieldSlots(classNames)}
      unstyled={unstyled}
      locale={locale}
      messages={messages}
    >
      <input
        id={ids.inputId}
        type="password"
        name={name}
        required
        minLength={minLength}
        autoComplete={autoComplete}
        aria-invalid={ids.errorId === undefined ? undefined : true}
        aria-describedby={ids.describedBy}
        className={slot("input")}
      />
    </Field>
  );
}

export interface MoneyFieldProps extends BaseFieldProps {
  /** The starting amount as text, in any notation `parseAmount` accepts for the locale. */
  readonly defaultValue?: string;
  readonly placeholder?: string;
  /** The currency drawn inside the field ("PLN", "€"). */
  readonly suffix?: string;
}

/**
 * An amount input. It shows the amount grouped in the locale's notation ("1 234,56" in `pl`) and
 * reformats on blur; text it cannot parse stays as typed, for the server to reject with a message.
 */
export function MoneyField({
  name,
  label,
  id,
  hint,
  hintAs,
  error,
  required = false,
  defaultValue = "",
  placeholder,
  suffix,
  classNames,
  unstyled,
  locale = "en",
  messages,
}: MoneyFieldProps) {
  const shown = normalizeAmountInput(useFieldValue(name, defaultValue), locale);
  const ids = useFieldIds({ id, name, error, hint, hintAs });
  const slot = createSlotClassGetter<"input" | "suffixWrap" | "suffix">({
    defaults: {
      input: suffix === undefined ? NUMBER_INPUT_CLASS : `${NUMBER_INPUT_CLASS} ${SUFFIX_PADDING_CLASS}`,
      ...SUFFIX_CLASSES,
    },
    classNames,
    unstyled,
  });
  return (
    <Field
      label={label}
      fieldId={ids.inputId}
      hint={hint}
      hintAs={hintAs}
      hintId={ids.hintId}
      error={ids.shownError}
      errorId={ids.errorId}
      classNames={pickFieldSlots(classNames)}
      unstyled={unstyled}
      locale={locale}
      messages={messages}
    >
      <WithSuffix suffix={suffix} slot={slot}>
        <input
          key={shown}
          id={ids.inputId}
          type="text"
          name={name}
          required={required}
          placeholder={placeholder}
          inputMode="decimal"
          autoComplete="off"
          defaultValue={shown}
          onBlur={(event) => {
            const next = normalizeAmountInput(event.currentTarget.value, locale);
            if (next !== event.currentTarget.value) event.currentTarget.value = next;
          }}
          aria-invalid={ids.errorId === undefined ? undefined : true}
          aria-describedby={ids.describedBy}
          className={slot("input")}
        />
      </WithSuffix>
    </Field>
  );
}

export interface SelectFieldProps extends Omit<BaseFieldProps, "required" | "classNames"> {
  readonly options: readonly SelectOption[];
  readonly defaultValue?: string;
  readonly classNames?: ClassNames<FieldSlot>;
  readonly selectClassNames?: ClassNames<SelectSlot>;
}

/** A labelled `Select` that sends its value under `name`. */
export function SelectField({
  name,
  label,
  id,
  hint,
  hintAs,
  error,
  options,
  defaultValue,
  classNames,
  selectClassNames,
  unstyled,
  locale,
  messages,
}: SelectFieldProps) {
  const value = useFieldValue(name, defaultValue ?? options[0]?.value ?? "");
  const submitCount = useSubmitCount();
  const ids = useFieldIds({ id, name, error, hint, hintAs });
  return (
    <Field
      label={label}
      fieldId={ids.inputId}
      hint={hint}
      hintAs={hintAs}
      hintId={ids.hintId}
      error={ids.shownError}
      errorId={ids.errorId}
      classNames={classNames}
      unstyled={unstyled}
      locale={locale}
      messages={messages}
    >
      <Select
        // Remount on every submit: the list keeps its own state, and a replay may repeat the value.
        key={`${value}|${submitCount}`}
        id={ids.inputId}
        name={name}
        defaultValue={value}
        options={options}
        aria-describedby={ids.describedBy}
        aria-invalid={ids.errorId === undefined ? undefined : true}
        locale={locale}
        classNames={selectClassNames}
        unstyled={unstyled}
      />
    </Field>
  );
}

export interface CheckboxFieldProps extends CopyProps<"field"> {
  readonly name: string;
  readonly label: string;
  readonly id?: string;
  readonly hint?: string;
  readonly hintAs?: HintPlacement;
  readonly defaultChecked?: boolean;
  /** `setting` (default) renders a `Switch`; `statement` a `Checkbox` (consent, confirmation). */
  readonly labelAs?: "setting" | "statement";
  readonly unstyled?: boolean;
}

/** A yes/no field that keeps its state across a rejected `ActionForm` submit. */
export function CheckboxField({
  name,
  label,
  id,
  hint,
  hintAs,
  defaultChecked = false,
  labelAs = "setting",
  unstyled,
  locale,
  messages,
}: CheckboxFieldProps) {
  const checked = getCheckedAfterSubmit(useSubmittedFieldNames(), name, defaultChecked);
  const key = `${String(checked)}|${useSubmitCount()}`;
  if (labelAs === "statement") {
    return <Checkbox key={key} id={id} name={name} label={label} description={hint} defaultChecked={checked} unstyled={unstyled} />;
  }
  return (
    <Switch
      key={key}
      id={id}
      name={name}
      label={label}
      hint={hintAs === "tooltip" ? hint : undefined}
      description={hintAs === "tooltip" ? undefined : hint}
      defaultChecked={checked}
      unstyled={unstyled}
      locale={locale}
      messages={messages}
    />
  );
}
