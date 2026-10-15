"use client";

import { formatMessage } from "@softure-ai/core";
import { type ReactNode, useId, useState } from "react";
import { normalizeAmountInput } from "./amount.js";
import { Button } from "./button.js";
import { type ClassNames, createSlotClassGetter } from "./class-names.js";
import { type CopyProps, getCopy } from "./copy.js";
import { useFieldValue } from "./form-context.js";
import { type InputFieldSlot, MoneyField, type MoneyFieldProps } from "./form-fields.js";
import { Hint, type HintAppearance } from "./hint.js";
import { useUiCopyProps, useUiLocale } from "./locale.js";

// A `MoneyField` with a suggested amount under it (last month's, the plan's) that the user can take with one press
// and still type their own. The suggestion is a chip or one inline row ("Suggested: 120 PLN use ?"); without a
// suggestion the row says so. The field stays a plain form field: a rejected submit replays what was sent.

export type SuggestedAmountFieldSlot = InputFieldSlot | "group" | "suggestionRow" | "suggestion" | "suggestionText";

export type SuggestedAmountFieldProps = Omit<MoneyFieldProps, "value" | "defaultValue" | "onValueChange" | "classNames"> & {
  /** The starting amount as text, in any notation `parseAmount` accepts. */
  readonly defaultValue?: string;
  /** Called with the text after every edit and after the suggestion fills the field. */
  readonly onValueChange?: (value: string) => void;
  /**
   * The suggested amount as text, in any notation `parseAmount` accepts for the locale. `null` (or left out) means
   * there is nothing to suggest: the row shows `messages.none` and no action.
   */
  readonly suggestedValue?: string | null;
  /** The action's text and name; by default "Use {amount}" (chip) or "use" named "Use {amount}" (inline). */
  readonly suggestionLabel?: string;
  /** A chip under the field (default) or one inline row: "Suggested: {amount}", a text button, the hint. */
  readonly suggestionVariant?: "chip" | "inline";
  /**
   * Why the field suggests this amount, or why it suggests none: a "?" after the action, named by
   * `messages.hintLabel` or `messages.noneHintLabel` with the field's label.
   */
  readonly suggestionHint?: ReactNode;
  /** The suggestion hint's classes, gap and width, as the app's other hints have them. */
  readonly suggestionHintProps?: HintAppearance;
  readonly classNames?: ClassNames<SuggestedAmountFieldSlot>;
  /** Copy overrides for the suggestion row. */
  readonly suggestionMessages?: CopyProps<"suggestedAmount">["messages"];
};

type OwnSlot = "group" | "suggestionRow" | "suggestion" | "suggestionText";

const ROW_CLASSES = {
  chip: "sft:mt-2 sft:flex sft:flex-wrap sft:items-center sft:gap-x-2 sft:gap-y-1",
  inline: "sft:mt-1.5 sft:flex sft:flex-wrap sft:items-center sft:gap-x-1.5 sft:gap-y-1 sft:text-xs sft:text-muted",
} as const;

const INLINE_ACTION_CLASS =
  "sft:cursor-pointer sft:border-0 sft:bg-transparent sft:p-0 sft:font-sans sft:text-xs sft:font-medium sft:text-accent sft:underline sft:underline-offset-2 sft:hover:text-foreground sft:focus-visible:outline-2 sft:focus-visible:outline-offset-2 sft:focus-visible:outline-focus";

/** An amount field with a "use the suggested amount" action, or a note that there is no suggestion. */
export function SuggestedAmountField({
  name,
  id,
  label,
  defaultValue = "",
  onValueChange,
  suggestedValue = null,
  suggestionLabel,
  suggestionVariant = "chip",
  suggestionHint,
  suggestionHintProps,
  suffix,
  classNames,
  unstyled,
  locale: explicitLocale,
  suggestionMessages,
  ...field
}: SuggestedAmountFieldProps) {
  const locale = useUiLocale(explicitLocale);
  const copy = getCopy("suggestedAmount", useUiCopyProps("suggestedAmount", { locale, messages: suggestionMessages }));
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

  const isInline = suggestionVariant === "inline";
  const slot = createSlotClassGetter<OwnSlot>({
    defaults: {
      group: "sft:block",
      suggestionRow: ROW_CLASSES[suggestionVariant],
      suggestion: isInline ? INLINE_ACTION_CLASS : "",
      // The inline row is already small and muted; a chip row's "No suggestion" gets the same look.
      suggestionText: isInline ? "" : "sft:text-xs sft:text-muted",
    },
    classNames,
    unstyled,
  });

  function renderAction(suggested: string): ReactNode {
    const amount = suffix === undefined ? suggested : `${suggested} ${suffix}`;
    const accessibleName = suggestionLabel ?? formatMessage(copy.use, { amount });
    function fill() {
      update(suggested);
      document.getElementById(inputId)?.focus();
    }
    if (!isInline) {
      return (
        <Button variant="secondary" size="sm" onClick={fill} className={slot("suggestion")} unstyled={unstyled}>
          {accessibleName}
        </Button>
      );
    }
    return (
      <>
        <span className={slot("suggestionText")}>{formatMessage(copy.suggested, { amount })}</span>
        <button type="button" aria-label={accessibleName} onClick={fill} className={slot("suggestion")}>
          {suggestionLabel ?? copy.useShort}
        </button>
      </>
    );
  }

  const hasSuggestion = suggestedValue !== null;
  return (
    <div className={slot("group")}>
      <MoneyField
        {...field}
        name={name}
        id={inputId}
        label={label}
        value={text}
        onValueChange={update}
        suffix={suffix}
        classNames={classNames}
        unstyled={unstyled}
        locale={locale}
      />
      <div className={slot("suggestionRow")}>
        {hasSuggestion ? (
          renderAction(normalizeAmountInput(suggestedValue, locale))
        ) : (
          <span className={slot("suggestionText")}>{copy.none}</span>
        )}
        {suggestionHint === undefined ? null : (
          <Hint
            {...suggestionHintProps}
            label={formatMessage(hasSuggestion ? copy.hintLabel : copy.noneHintLabel, { label })}
            anchorLeft
            unstyled={unstyled}
          >
            {suggestionHint}
          </Hint>
        )}
      </div>
    </div>
  );
}
