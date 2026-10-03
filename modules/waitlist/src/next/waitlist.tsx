// The waitlist form wired to the registered config, to embed in any server component with one line:
// `<Waitlist placement="hero" />`. Scope labels come from `waitlist({ scopes })` in the app's
// locale; `consentLabels` replaces one with markup, e.g. a link to the privacy policy.
import { getSoftureConfig } from "@softure-ai/core/next";
import type { ClassNames } from "@softure-ai/ui";
import type { ReactNode } from "react";
import { getLocalizedText, getWaitlistMessages, getWaitlistOptions } from "../server/options.js";
import { WaitlistForm, type WaitlistFormSlot } from "../ui/waitlist-form.js";
import { joinWaitlistAction } from "./actions.js";

export interface WaitlistProps {
  /** Where the form sits, one of `waitlist({ placements })`; defaults to the first one. */
  readonly placement?: string;
  /** Labels with markup per scope id, in place of the config's text. */
  readonly consentLabels?: Readonly<Partial<Record<string, ReactNode>>>;
  readonly classNames?: ClassNames<WaitlistFormSlot>;
  readonly unstyled?: boolean;
}

export function Waitlist({ placement, consentLabels, classNames, unstyled }: WaitlistProps) {
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
    />
  );
}
