"use client";

import { formatMessage } from "@softure-ai/core";
import { useId, useState } from "react";
import { type ClassNames, createSlotClassGetter } from "./class-names.js";
import { type CopyProps, getCopy } from "./copy.js";
import { Field, type FieldSlot, getDescribedBy, INPUT_CLASS } from "./field.js";
import { useFieldError, useFieldValue } from "./form-context.js";
import type { BaseFieldProps, FieldValueProps } from "./form-fields.js";
import { useUiCopyProps, useUiLocale } from "./locale.js";

// A colour as hex text with a native colour picker as its swatch. Only the text input is submitted (`name`),
// so the value is the text the user sees; the picker and the text follow each other. Text that is not a hex
// colour stays as typed for the `pattern` (and the server) to reject, and the swatch keeps the last valid colour.

export type ColorFieldSlot = FieldSlot | "row" | "swatch" | "input";

export type ColorFieldProps = Omit<BaseFieldProps, "classNames"> &
  FieldValueProps & {
    readonly placeholder?: string;
    readonly classNames?: ClassNames<ColorFieldSlot>;
    /** Copy overrides for the picker's name. */
    readonly pickerMessages?: CopyProps<"colorField">["messages"];
  };

const HEX_PATTERN = "#[0-9a-fA-F]{6}";

/** `#rrggbb` in lower case from `#rgb`, `#rrggbb` or the same without `#`; `null` for anything else. */
export function normalizeHexColor(text: string): string | null {
  const match = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(text.trim());
  const digits = match?.[1]?.toLowerCase();
  if (digits === undefined) return null;
  const full = digits.length === 3 ? Array.from(digits, (digit) => digit + digit).join("") : digits;
  return `#${full}`;
}

const COLOR_FIELD_CLASSES = {
  row: "sft:flex sft:items-center sft:gap-2",
  swatch:
    "sft:m-0 sft:box-border sft:size-10 sft:shrink-0 sft:cursor-pointer sft:appearance-none sft:rounded-control sft:border sft:border-border-strong sft:bg-surface sft:p-1 sft:focus-visible:outline-2 sft:focus-visible:outline-offset-2 sft:focus-visible:outline-focus sft:[&::-webkit-color-swatch-wrapper]:p-0 sft:[&::-webkit-color-swatch]:rounded-control sft:[&::-webkit-color-swatch]:border-0 sft:[&::-moz-color-swatch]:rounded-control sft:[&::-moz-color-swatch]:border-0",
  input: `${INPUT_CLASS} sft:font-mono`,
} as const;

/** A labelled hex colour field with a colour picker swatch. */
export function ColorField({
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
  classNames,
  unstyled,
  locale: explicitLocale,
  messages,
  pickerMessages,
}: ColorFieldProps) {
  const locale = useUiLocale(explicitLocale);
  const copy = getCopy("colorField", useUiCopyProps("colorField", { locale, messages: pickerMessages }));
  const generatedId = useId();
  const inputId = id ?? generatedId;
  const replayed = useFieldValue(name, defaultValue);
  const [draft, setDraft] = useState(replayed);
  const [seenReplay, setSeenReplay] = useState(replayed);
  const [lastValid, setLastValid] = useState(normalizeHexColor(replayed) ?? "");
  // A rejected submit that replays another value restarts the draft from it.
  if (seenReplay !== replayed) {
    setSeenReplay(replayed);
    setDraft(replayed);
  }
  const text = controlledValue ?? draft;
  // Without a valid colour yet the picker gets "", which the browser shows as its default (black).
  const swatch = normalizeHexColor(text) ?? lastValid;

  const replayedError = useFieldError(name);
  const shownError = error !== undefined && error !== "" ? error : replayedError;
  const errorId = shownError === undefined || shownError === "" ? undefined : `${inputId}-error`;
  const hintId = `${inputId}-hint`;
  const describedBy = getDescribedBy({ errorId, hintId, hasBlockHint: hint !== undefined && hintAs !== "tooltip" });

  function update(next: string) {
    if (controlledValue === undefined) setDraft(next);
    const valid = normalizeHexColor(next);
    if (valid !== null) setLastValid(valid);
    onValueChange?.(next);
  }

  const slot = createSlotClassGetter<"row" | "swatch" | "input">({
    defaults: COLOR_FIELD_CLASSES,
    classNames,
    unstyled,
  });
  const { root, labelRow, label: labelClass, tooltip, error: errorClass, hint: hintClass } = classNames ?? {};
  return (
    <Field
      label={label}
      fieldId={inputId}
      hint={hint}
      hintAs={hintAs}
      hintId={hintId}
      hintProps={hintProps}
      error={shownError}
      errorId={errorId}
      classNames={{ root, labelRow, label: labelClass, tooltip, error: errorClass, hint: hintClass }}
      unstyled={unstyled}
      locale={locale}
      messages={messages}
    >
      <span className={slot("row")}>
        <input
          type="color"
          value={swatch}
          onChange={(event) => update(event.currentTarget.value)}
          aria-label={formatMessage(copy.picker, { label })}
          className={slot("swatch")}
        />
        <input
          id={inputId}
          type="text"
          name={name}
          value={text}
          onChange={(event) => update(event.currentTarget.value)}
          onBlur={(event) => {
            const typed = event.currentTarget.value;
            const next = normalizeHexColor(typed);
            if (next !== null && next !== typed) update(next);
          }}
          required={required}
          pattern={HEX_PATTERN}
          placeholder={placeholder}
          autoComplete="off"
          spellCheck={false}
          maxLength={7}
          aria-invalid={errorId === undefined ? undefined : true}
          aria-describedby={describedBy}
          className={slot("input")}
        />
      </span>
    </Field>
  );
}
