"use client";

import type { Locale } from "@softure-ai/core";
import { type ClassNames, createSlotClassGetter, FormError, Switch } from "@softure-ai/ui";
import { useActionState, useState, useTransition } from "react";
import type { SwitchFormState } from "../contract.js";
import { type FeatureSwitchesMessages, getSwitchErrorMessage } from "../messages/index.js";

// The switches panel: one row per declared switch, each a ui `Switch` that saves on change through
// the panel's server action (`useActionState`). The row shows the requested value while the save
// runs and the server's answer after it; a refused or failed save puts the old value back and
// shows the error. Copy comes from the module's messages; styling only from @softure-ai/ui classes.

export type SwitchPanelAction = (previous: SwitchFormState, formData: FormData) => Promise<SwitchFormState>;

export type SwitchPanelSlot = "root" | "list" | "item" | "note" | "empty";

/** One switch as the panel renders it; the page prepares it on the server. */
export interface SwitchPanelRow {
  readonly name: string;
  readonly label: string;
  readonly description: string | null;
  readonly isEnabled: boolean;
  /** Held by its environment override: the toggle is disabled. */
  readonly isLocked: boolean;
  /** Where the value comes from, already in the app's copy. */
  readonly note: string;
}

export interface SwitchPanelProps {
  readonly switches: readonly SwitchPanelRow[];
  readonly action: SwitchPanelAction;
  readonly messages: FeatureSwitchesMessages;
  /** Locale of the built-in copy of the ui primitives. */
  readonly locale?: Locale;
  readonly classNames?: ClassNames<SwitchPanelSlot>;
  readonly unstyled?: boolean;
}

const DEFAULT_CLASSES: Readonly<Record<SwitchPanelSlot, string>> = {
  root: "sft:flex sft:flex-col sft:gap-3 sft:font-sans",
  list: "sft:m-0 sft:flex sft:list-none sft:flex-col sft:gap-3 sft:p-0",
  item: "sft:flex sft:flex-col sft:gap-1",
  note: "sft:m-0 sft:text-xs sft:text-muted",
  empty: "sft:m-0 sft:text-sm sft:text-muted",
};

function SwitchItem({
  row,
  action,
  messages,
  locale,
  slot,
  unstyled,
}: {
  row: SwitchPanelRow;
  action: SwitchPanelAction;
  messages: FeatureSwitchesMessages;
  locale: Locale | undefined;
  slot: (part: SwitchPanelSlot) => string | undefined;
  unstyled: boolean | undefined;
}) {
  const [state, dispatch, isPending] = useActionState(action, { status: "idle", isEnabled: row.isEnabled });
  const [requested, setRequested] = useState(row.isEnabled);
  const [, startTransition] = useTransition();

  function save(isEnabled: boolean) {
    setRequested(isEnabled);
    const formData = new FormData();
    formData.set("name", row.name);
    if (isEnabled) formData.set("enabled", "on");
    startTransition(() => dispatch(formData));
  }

  return (
    <li className={slot("item")}>
      <Switch
        label={row.label}
        description={row.description ?? undefined}
        stateText={{ on: messages.panel.on, off: messages.panel.off }}
        checked={isPending ? requested : state.isEnabled}
        onChange={save}
        disabled={row.isLocked || isPending}
        locale={locale}
        unstyled={unstyled}
      />
      <p className={slot("note")}>{row.note}</p>
      <FormError message={state.error === undefined ? undefined : getSwitchErrorMessage(messages, state.error)} unstyled={unstyled} />
    </li>
  );
}

/** Every declared switch with its toggle; the empty state when the app declares none. */
export function SwitchPanel({ switches, action, messages, locale, classNames, unstyled }: SwitchPanelProps) {
  const slot = createSlotClassGetter({ defaults: DEFAULT_CLASSES, classNames, unstyled });
  return (
    <div className={slot("root")}>
      {switches.length === 0 ? (
        <p className={slot("empty")}>{messages.panel.empty}</p>
      ) : (
        <ul className={slot("list")}>
          {switches.map((row) => (
            <SwitchItem key={row.name} row={row} action={action} messages={messages} locale={locale} slot={slot} unstyled={unstyled} />
          ))}
        </ul>
      )}
    </div>
  );
}
