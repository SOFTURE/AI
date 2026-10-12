"use client";

import { formatMessage } from "@softure-ai/core";
import { useId, useState } from "react";
import { normalizeAmountInput } from "./amount.js";
import { Button } from "./button.js";
import { type ClassNames, createSlotClassGetter } from "./class-names.js";
import { type CopyProps, getCopy } from "./copy.js";
import { useFieldValue } from "./form-context.js";
import { type InputFieldSlot, MoneyField, type MoneyFieldProps } from "./form-fields.js";
import { useUiLocale } from "./locale.js";

// A `MoneyField` with a chip under it that fills a suggested amount (last month's, the plan's), so the user can
// take it with one press and still type their own. The field stays a plain form field: a rejected submit replays
// what was sent.

export type SuggestedAmountFieldSlot = InputFieldSlot | "group" | "suggestion";

export type SuggestedAmountFieldProps = Omit<MoneyFieldProps, "value" | "defaultValue" | "onValueChange" | "classNames"> & {
  /** The starting amount as text, in any notation `parseAmount` accepts. */
  readonly defaultValue?: string;
  /** Called with the text after every edit and after the chip fills the field. */
  readonly onValueChange?: (value: string) => void;
  /** The suggested amount as text, in any notation `parseAmount` accepts for the locale. */
  readonly suggestedValue: string;
  /** The chip's text; by default "Use {amount}" with the formatted amount and the suffix. */
  readonly suggestionLabel?: string;
  readonly classNames?: ClassNames<SuggestedAmountFieldSlot>;
  /** Copy overrides for the chip. */
  readonly suggestionMessages?: CopyProps<"suggestedAmount">["messages"];
};

/** An amount field with a "use the suggested amount" chip. */
export function SuggestedAmountField({
  name,
  id,
  defaultValue = "",
  onValueChange,
  suggestedValue,
  suggestionLabel,
  suffix,
  classNames,
  unstyled,
  locale: explicitLocale,
  suggestionMessages,
  ...field
}: SuggestedAmountFieldProps) {
  const locale = useUiLocale(explicitLocale);
  const copy = getCopy("suggestedAmount", { locale, messages: suggestionMessages });
  const generatedId = useId();
  const inputId = id ?? generatedId;
  const replayed = normalizeAmountInput(useFieldValue(name, defaultValue), locale);
  const [text, setText] = useState(replayed);
  const [seenReplay, setSeenReplay] = useState(replayed);
  // A rejected submit that replays another value restarts the field from it.
  if (seenReplay !== replayed) {
    setSeenReplay(replayed);
    setText(replayed);
  }

  function update(next: string) {
    setText(next);
    onValueChange?.(next);
  }

  const suggested = normalizeAmountInput(suggestedValue, locale);
  const amount = suffix === undefined ? suggested : `${suggested} ${suffix}`;
  const slot = createSlotClassGetter<"group" | "suggestion">({
    defaults: { group: "sft:block", suggestion: "sft:mt-2" },
    classNames,
    unstyled,
  });
  return (
    <div className={slot("group")}>
      <MoneyField
        {...field}
        name={name}
        id={inputId}
        value={text}
        onValueChange={update}
        suffix={suffix}
        classNames={classNames}
        unstyled={unstyled}
        locale={locale}
      />
      <Button
        variant="secondary"
        size="sm"
        onClick={() => {
          update(suggested);
          document.getElementById(inputId)?.focus();
        }}
        className={slot("suggestion")}
        unstyled={unstyled}
      >
        {suggestionLabel ?? formatMessage(copy.use, { amount })}
      </Button>
    </div>
  );
}
