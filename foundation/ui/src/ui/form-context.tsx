"use client";

import { createContext, type ReactNode, useContext } from "react";

// What `ActionForm` hands its fields after a submit: the values to replay after a rejected submit
// (React resets an uncontrolled form after its action), the field errors, and a submit counter that
// lets a field remount when the same value is submitted twice.

/** Form values as text, by field name. */
export type SubmittedValues = Readonly<Record<string, string>>;
/** Error messages by field name. */
export type FieldErrors = Readonly<Record<string, string>>;

export interface FormReplay {
  readonly values: SubmittedValues;
  readonly fieldErrors: FieldErrors;
  readonly submitCount: number;
}

const EMPTY_REPLAY: FormReplay = { values: {}, fieldErrors: {}, submitCount: 0 };

const FormReplayContext = createContext<FormReplay>(EMPTY_REPLAY);

export function FormReplayProvider({ replay, children }: { readonly replay: FormReplay; readonly children: ReactNode }) {
  return <FormReplayContext.Provider value={replay}>{children}</FormReplayContext.Provider>;
}

/** The value a rejected submit sent for `name`, else `fallback`. */
export function useFieldValue(name: string, fallback = ""): string {
  return useContext(FormReplayContext).values[name] ?? fallback;
}

/** The error the last submit returned for `name`. */
export function useFieldError(name: string): string | undefined {
  return useContext(FormReplayContext).fieldErrors[name];
}

/** How many times the form was submitted. */
export function useSubmitCount(): number {
  return useContext(FormReplayContext).submitCount;
}

/**
 * Names the rejected submit carried, or `null` when nothing was replayed. A checkbox is absent from
 * form data when unchecked, so presence of its name is its replayed state.
 */
export function useSubmittedFieldNames(): ReadonlySet<string> | null {
  const names = Object.keys(useContext(FormReplayContext).values);
  return names.length === 0 ? null : new Set(names);
}

/** A checkbox's state after a submit: the data's value, or the submitted presence of its name. */
export function getCheckedAfterSubmit(
  submittedNames: ReadonlySet<string> | null,
  name: string,
  defaultChecked: boolean,
): boolean {
  return submittedNames === null ? defaultChecked : submittedNames.has(name);
}
