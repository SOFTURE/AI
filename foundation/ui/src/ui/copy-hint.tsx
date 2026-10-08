"use client";

import { formatMessage } from "@softure-ai/core";
import type { ReactNode } from "react";
import type { UiMessages } from "../messages/index.js";
import { type CopyProps, getCopy } from "./copy.js";
import { Hint, type HintAppearance } from "./hint.js";
import { useUiLocale } from "./locale.js";

/** Message groups whose `hintLabel` names a "?" next to a title or a label. */
type HintGroup = { [Group in keyof UiMessages]: UiMessages[Group] extends { hintLabel: string } ? Group : never }[keyof UiMessages];

export interface CopyHintProps<Group extends HintGroup> extends CopyProps<Group> {
  readonly group: Group;
  /** The values of the group's `hintLabel` template, e.g. `{ title }`. */
  readonly values: Readonly<Record<string, string>>;
  readonly id?: string;
  /** The hint's classes, gap and width, as the caller's own hints have them. */
  readonly appearance?: HintAppearance;
  readonly children: ReactNode;
}

/**
 * A "?" hint named by a package message, for server-safe components: the label is formatted here, in
 * the client, so it follows `UiLocaleProvider`.
 */
export function CopyHint<Group extends HintGroup>({ group, values, id, appearance, locale, messages, children }: CopyHintProps<Group>) {
  const copy = getCopy(group, { locale: useUiLocale(locale), messages }) as { readonly hintLabel: string };
  return (
    <Hint {...appearance} label={formatMessage(copy.hintLabel, values)} id={id} anchorLeft>
      {children}
    </Hint>
  );
}
