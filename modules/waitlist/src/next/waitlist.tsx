// The waitlist form wired to the registered config, to embed in any server component with one line:
// `<Waitlist placement="hero" />`. Scope labels come from `waitlist({ scopes })` in the app's
// locale; `consentLabels` replaces one with markup, e.g. a link to the privacy policy. `success` is a node only:
// a server component cannot hand functions to the client form, so `onSuccess` needs `WaitlistForm` itself. The look
// props (field and box classes, button look, ids) are plain data and pass straight through.
import { getSoftureConfig } from "@softure-ai/core/next";
import type { ClassNames } from "@softure-ai/ui";
import type { ReactNode } from "react";
import { getLocalizedText, getWaitlistMessages, getWaitlistOptions } from "../server/options.js";
import { WaitlistForm, type WaitlistFormProps, type WaitlistFormSlot } from "../ui/waitlist-form.js";
import { joinWaitlistAction } from "./actions.js";

/** The form's look props `Waitlist` passes through unchanged. */
type WaitlistLookProps = Pick<
  WaitlistFormProps,
  "emailProps" | "fieldClassNames" | "fieldHintAs" | "fieldHintProps" | "scopeClassNames" | "submitVariant" | "submitFullWidth"
>;

export interface WaitlistProps extends WaitlistLookProps {
  /** Where the form sits, one of `waitlist({ placements })`; defaults to the first one. */
  readonly placement?: string;
  /** Labels with markup per scope id, in place of the config's text. */
  readonly consentLabels?: Readonly<Partial<Record<string, ReactNode>>>;
  /** A line under the statement per scope id (see `WaitlistFormScope.description`). */
  readonly consentDescriptions?: Readonly<Partial<Record<string, ReactNode>>>;
  /** The box's id per scope id, unique on the page (see `WaitlistFormScope.inputId`). */
  readonly consentIds?: Readonly<Partial<Record<string, string>>>;
  readonly classNames?: ClassNames<WaitlistFormSlot>;
  readonly unstyled?: boolean;
  /** The app's view in place of the default success notice (see `WaitlistFormProps.success`). */
  readonly success?: ReactNode;
}

export function Waitlist({ placement, consentLabels, consentDescriptions, consentIds, classNames, unstyled, success, ...look }: WaitlistProps) {
  const config = getSoftureConfig();
  const options = getWaitlistOptions(config);
  const resolvedPlacement = placement ?? options.placements[0];
  if (resolvedPlacement === undefined || !options.placements.includes(resolvedPlacement)) {
    throw new Error(`@softure-ai/waitlist: <Waitlist placement="${String(placement)}"> is not one of waitlist({ placements })`);
  }
  const scopes = options.scopes.map((scope) => ({
    id: scope.id,
    label: consentLabels?.[scope.id] ?? getLocalizedText(scope.label, config.locale),
    required: scope.required,
    description: consentDescriptions?.[scope.id],
    inputId: consentIds?.[scope.id],
  }));
  return (
    <WaitlistForm
      action={joinWaitlistAction}
      scopes={scopes}
      placement={resolvedPlacement}
      messages={getWaitlistMessages(config)}
      locale={config.locale}
      classNames={classNames}
      unstyled={unstyled}
      success={success}
      {...look}
    />
  );
}
