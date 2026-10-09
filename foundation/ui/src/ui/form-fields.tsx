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
import type { HintAppearance } from "./hint.js";
import { Select, type SelectOption, type SelectSlot } from "./select.js";
import { Checkbox, Switch } from "./switch.js";
import { useUiLocale } from "./locale.js";

// Labelled form fields. Inside an `ActionForm` they replay the values of a rejected submit and show
// its field errors; outside one they are plain uncontrolled fields.

export type InputFieldSlot = FieldSlot | "input" | "suffixWrap" | "suffix";

/** What every labelled field takes. */
export interface BaseFieldProps extends CopyProps<"field"> {
  readonly name: string;
  readonly label: string;
  /** Control id; generated when omitted (a name may repeat on a page, an id may not). */
  readonly id?: string;
  readonly hint?: string;
  readonly hintAs?: HintPlacement;
  /** The tooltip hint's classes, gap and width, so it matches the app's standalone hints. */
  readonly hintProps?: HintAppearance;
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
  const { root, labelRow, label, tooltip, error, hint } = classNames;
  return { root, labelRow, label, tooltip, error, hint };
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

/**
 * Uncontrolled (the default): the field keeps its text, starting from `defaultValue` or the replayed submit.
 * Controlled: the caller owns `value` and updates it from `onValueChange`, for a live calculation; a rejected
 * submit's replayed value is then the caller's to restore.
 */
export type FieldValueProps =
  | {
      readonly value?: undefined;
      readonly defaultValue?: string;
      /** Called with the text after every edit. */
      readonly onValueChange?: (value: string) => void;
    }
  | {
      readonly value: string;
      readonly defaultValue?: undefined;
      readonly onValueChange: (value: string) => void;
    };

interface TextFieldOwnProps {
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

export type TextFieldProps = BaseFieldProps & FieldValueProps & TextFieldOwnProps;

/** A labelled text input. */
export function TextField({
  name,
  label,
  id,
  hint,
  hintAs,
  hintProps,
  error,
  required = false,
  value: controlledValue,
  defaultValue = "",
  onValueChange,
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
  const replayed = useFieldValue(name, defaultValue);
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
      hintProps={hintProps}
      error={ids.shownError}
      errorId={ids.errorId}
      classNames={pickFieldSlots(classNames)}
      unstyled={unstyled}
      locale={locale}
      messages={messages}
    >
      <WithSuffix suffix={suffix} slot={slot}>
        <input
          // Uncontrolled, a new key remounts the input when a rejected submit replays another value.
          key={controlledValue === undefined ? replayed : undefined}
          value={controlledValue}
          defaultValue={controlledValue === undefined ? replayed : undefined}
          onChange={onValueChange === undefined ? undefined : (event) => onValueChange(event.currentTarget.value)}
          id={ids.inputId}
          type={type}
          name={name}
          required={required}
          placeholder={placeholder}
          inputMode={inputMode}
          autoComplete={autoComplete}
          maxLength={maxLength}
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
  hintProps,
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
      hintProps={hintProps}
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

/**
 * `defaultValue` is the starting amount as text, in any notation `parseAmount` accepts for the locale. A controlled
 * `value` is shown as given; on blur `onValueChange` receives it reformatted when it parses.
 */
interface MoneyFieldOwnProps {
  readonly placeholder?: string;
  /** The currency drawn inside the field ("PLN", "€"). */
  readonly suffix?: string;
}

export type MoneyFieldProps = BaseFieldProps & FieldValueProps & MoneyFieldOwnProps;

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
  hintProps,
  error,
  required = false,
  value: controlledValue,
  defaultValue = "",
  onValueChange,
  placeholder,
  suffix,
  classNames,
  unstyled,
  locale: explicitLocale,
  messages,
}: MoneyFieldProps) {
  const locale = useUiLocale(explicitLocale);
  const replayed = normalizeAmountInput(useFieldValue(name, defaultValue), locale);
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
      hintProps={hintProps}
      error={ids.shownError}
      errorId={ids.errorId}
      classNames={pickFieldSlots(classNames)}
      unstyled={unstyled}
      locale={locale}
      messages={messages}
    >
      <WithSuffix suffix={suffix} slot={slot}>
        <input
          // Uncontrolled, a new key remounts the input when a rejected submit replays another value.
          key={controlledValue === undefined ? replayed : undefined}
          value={controlledValue}
          defaultValue={controlledValue === undefined ? replayed : undefined}
          onChange={onValueChange === undefined ? undefined : (event) => onValueChange(event.currentTarget.value)}
          id={ids.inputId}
          type="text"
          name={name}
          required={required}
          placeholder={placeholder}
          inputMode="decimal"
          autoComplete="off"
          onBlur={(event) => {
            const typed = event.currentTarget.value;
            const next = normalizeAmountInput(typed, locale);
            if (next === typed) return;
            // A controlled field shows what its owner passes back; an uncontrolled one is rewritten in place.
            if (controlledValue === undefined) event.currentTarget.value = next;
            onValueChange?.(next);
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
  hintProps,
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
      hintProps={hintProps}
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
