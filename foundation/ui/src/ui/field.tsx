import type { ReactNode } from "react";
import { type ClassNames, createSlotClassGetter } from "./class-names.js";
import type { CopyProps } from "./copy.js";
import { CopyHint } from "./copy-hint.js";
import type { HintAppearance } from "./hint.js";

// Field frame and input looks; server-safe.

/** Where a field's hint stands: under the field, or behind a "?" next to the label. */
export type HintPlacement = "block" | "tooltip";

/**
 * The one input look (text inputs and the select trigger). A fixed `h-10` matches the `md` button
 * in the same row. Focus draws a ring of fixed width instead of changing the border width, so
 * nothing shifts. Below `sm` the text is 16 px, so iOS Safari does not zoom on focus. Errors come
 * from `aria-invalid` (set by code) and `:user-invalid` (native validation, only after the user
 * interacted); the `…:focus:` and `…:hover:` error variants keep the red border while the user
 * fixes the field, because the plain focus and hover rules come later in the sheet.
 */
export const INPUT_CLASS =
  "sft:m-0 sft:box-border sft:h-10 sft:w-full sft:rounded-control sft:border sft:border-border-strong sft:bg-surface sft:px-3 sft:font-sans sft:text-base sft:text-foreground sft:outline-none sft:transition-colors sft:duration-(--sft-duration-fast) sft:hover:border-foreground sft:focus:border-focus sft:focus:ring-1 sft:focus:ring-focus sft:sm:text-sm sft:aria-invalid:border-danger sft:aria-invalid:ring-1 sft:aria-invalid:ring-danger/40 sft:aria-invalid:hover:border-danger sft:aria-invalid:focus:border-danger sft:aria-invalid:focus:ring-2 sft:aria-invalid:focus:ring-danger/60 sft:user-invalid:border-danger sft:user-invalid:ring-1 sft:user-invalid:ring-danger/40 sft:user-invalid:hover:border-danger sft:user-invalid:focus:border-danger sft:user-invalid:focus:ring-2 sft:user-invalid:focus:ring-danger/60";

/**
 * The input look for numbers: equal-width digits, so typed amounts line up with shown ones, and a
 * slashed zero, so 0 and O never read alike.
 */
export const NUMBER_INPUT_CLASS = `${INPUT_CLASS} sft:font-mono sft:tabular-nums sft:slashed-zero sft:placeholder:font-sans`;

/** Extra right padding for an input that shows a unit suffix. */
export const SUFFIX_PADDING_CLASS = "sft:pr-14";

export type FieldSlot = "root" | "labelRow" | "label" | "error" | "hint";

export interface FieldProps extends CopyProps<"field"> {
  readonly label: string;
  /** The control: an input, a select, a group of controls. */
  readonly children: ReactNode;
  /** `id` of the control the label names (`<label for>`). */
  readonly fieldId?: string;
  readonly hint?: string;
  readonly hintAs?: HintPlacement;
  /** `id` of the hint (block text or bubble), which the control points at with `aria-describedby`. */
  readonly hintId?: string;
  /** The tooltip hint's classes, gap and width, so it matches the app's standalone hints. */
  readonly hintProps?: HintAppearance;
  /** The error under the control; an empty string is no error. */
  readonly error?: string;
  /** `id` of the error, which the control points at with `aria-describedby` (error first). */
  readonly errorId?: string;
  readonly classNames?: ClassNames<FieldSlot>;
  readonly unstyled?: boolean;
}

const FIELD_CLASSES: Readonly<Record<FieldSlot, string>> = {
  root: "sft:block sft:font-sans",
  labelRow: "sft:mb-1.5 sft:flex sft:items-baseline sft:gap-1.5",
  label: "sft:text-sm sft:font-medium sft:text-foreground",
  error: "sft:mt-1.5 sft:mb-0 sft:text-sm sft:leading-snug sft:text-danger",
  hint: "sft:mt-1.5 sft:block sft:text-xs sft:leading-relaxed sft:text-muted",
};

/**
 * A label, a control, its error and its hint. The "?" of a tooltip hint stands next to the label,
 * not inside it: a button inside a `<label>` would join the field's accessible name. So the label
 * names the control through `htmlFor`, and the error has no `role="alert"` (the form-level error
 * or moved focus announces it once).
 */
export function Field({
  label,
  children,
  fieldId,
  hint,
  hintAs = "block",
  hintId,
  hintProps,
  error,
  errorId,
  classNames,
  unstyled,
  locale,
  messages,
}: FieldProps) {
  const slot = createSlotClassGetter({ defaults: FIELD_CLASSES, classNames, unstyled });
  const isTooltip = hintAs === "tooltip" && hint !== undefined;
  return (
    <div className={slot("root")}>
      <div className={slot("labelRow")}>
        <label htmlFor={fieldId} className={slot("label")}>
          {label}
        </label>
        {isTooltip ? (
          <CopyHint group="field" values={{ label }} id={hintId} appearance={hintProps} locale={locale} messages={messages}>
            {hint}
          </CopyHint>
        ) : null}
      </div>
      {children}
      {error === undefined || error === "" ? null : (
        <p id={errorId} className={slot("error")}>
          {error}
        </p>
      )}
      {hint === undefined || isTooltip ? null : (
        <span id={hintId} className={slot("hint")}>
          {hint}
        </span>
      )}
    </div>
  );
}

export type FieldGroupSlot = "root" | "header" | "title" | "rule";

export interface FieldGroupProps {
  readonly title: string;
  readonly children: ReactNode;
  readonly classNames?: ClassNames<FieldGroupSlot>;
  readonly unstyled?: boolean;
}

const FIELD_GROUP_CLASSES: Readonly<Record<FieldGroupSlot, string>> = {
  root: "sft:flex sft:flex-col sft:gap-3 sft:font-sans",
  header: "sft:flex sft:items-center sft:gap-3",
  title: "sft:m-0 sft:shrink-0 sft:text-sm sft:font-semibold sft:text-foreground",
  rule: "sft:h-px sft:grow sft:bg-border",
};

/** A titled group of fields inside one form: seams without splitting the form. */
export function FieldGroup({ title, children, classNames, unstyled }: FieldGroupProps) {
  const slot = createSlotClassGetter({ defaults: FIELD_GROUP_CLASSES, classNames, unstyled });
  return (
    <section className={slot("root")}>
      <div className={slot("header")}>
        <h3 className={slot("title")}>{title}</h3>
        <span aria-hidden="true" className={slot("rule")} />
      </div>
      {children}
    </section>
  );
}

/** `aria-describedby` of a control: the error first, then a hint shown under the field. */
export function getDescribedBy({
  errorId,
  hintId,
  hasBlockHint,
}: {
  errorId: string | undefined;
  hintId: string;
  hasBlockHint: boolean;
}): string | undefined {
  const ids = [errorId, hasBlockHint ? hintId : undefined].filter((id) => id !== undefined);
  return ids.length === 0 ? undefined : ids.join(" ");
}
