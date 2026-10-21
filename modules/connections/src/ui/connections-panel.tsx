"use client";

import type { Locale } from "@softure-ai/core";
import { Button, type ClassNames, createSlotClassGetter, FormError, PasswordField, TextField } from "@softure-ai/ui";
import { useActionState } from "react";
import type { ConnectionFormState, ConnectionKind, ConnectionStatus } from "../contract.js";
import { type ConnectionsMessages, getConnectionsErrorMessage } from "../messages/index.js";

// The connections panel: one item per declared provider account with its status and details, and its actions.
// OAuth accounts get connect or reconnect (a server action that sends the browser to the provider); API key
// and Basic accounts get a form whose secret field is never filled back in. A connected account can be
// disconnected. Every form posts to a server action through `useActionState` and shows its error in place.
// Copy comes from the module's messages; styling only from @softure-ai/ui classes.

export type ConnectionPanelAction = (previous: ConnectionFormState, formData: FormData) => Promise<ConnectionFormState>;

export interface ConnectionPanelActions {
  readonly start: ConnectionPanelAction;
  readonly save: ConnectionPanelAction;
  readonly disconnect: ConnectionPanelAction;
}

export type ConnectionsPanelSlot = "root" | "notice" | "list" | "item" | "header" | "title" | "status" | "details" | "detail" | "hint" | "actions" | "empty";

/** One provider account as the panel renders it; the page prepares it on the server. */
export interface ConnectionPanelRow {
  readonly provider: string;
  readonly accountId: string;
  readonly kind: ConnectionKind;
  readonly label: string;
  readonly status: ConnectionStatus;
  readonly statusLabel: string;
  /** Lines under the title, already in the app's copy. */
  readonly details: readonly string[];
  readonly lastError: string | null;
  /** Where to find the key (API key and Basic providers). */
  readonly hint: string | null;
}

/** A line above the list: the callback's outcome. */
export type ConnectionsPanelNotice = { readonly tone: "success" | "error"; readonly text: string } | null;

export interface ConnectionsPanelProps {
  readonly rows: readonly ConnectionPanelRow[];
  readonly actions: ConnectionPanelActions;
  readonly messages: ConnectionsMessages;
  readonly notice?: ConnectionsPanelNotice;
  /** Locale of the built-in copy of the ui primitives. */
  readonly locale?: Locale;
  readonly classNames?: ClassNames<ConnectionsPanelSlot>;
  readonly unstyled?: boolean;
}

const DEFAULT_CLASSES: Readonly<Record<ConnectionsPanelSlot, string>> = {
  root: "sft:flex sft:flex-col sft:gap-3 sft:font-sans",
  notice: "sft:m-0 sft:rounded-control sft:border sft:border-border sft:px-3 sft:py-2 sft:text-sm sft:text-foreground",
  list: "sft:m-0 sft:flex sft:list-none sft:flex-col sft:gap-4 sft:p-0",
  item: "sft:flex sft:flex-col sft:gap-2",
  header: "sft:flex sft:flex-wrap sft:items-center sft:justify-between sft:gap-2",
  title: "sft:m-0 sft:text-sm sft:font-medium sft:text-foreground",
  status: "sft:text-xs sft:font-medium",
  details: "sft:m-0 sft:flex sft:list-none sft:flex-col sft:gap-1 sft:p-0",
  detail: "sft:m-0 sft:text-xs sft:text-muted",
  hint: "sft:m-0 sft:text-xs sft:text-muted",
  actions: "sft:flex sft:flex-wrap sft:items-end sft:gap-2",
  empty: "sft:m-0 sft:text-sm sft:text-muted",
};

const STATUS_TONES: Readonly<Record<ConnectionStatus, string>> = {
  connected: "sft:text-success",
  expiring: "sft:text-warning",
  reconnect_required: "sft:text-danger",
  not_connected: "sft:text-muted",
};

const IDLE: ConnectionFormState = { status: "idle" };

type Slot = (part: ConnectionsPanelSlot) => string | undefined;

interface ItemProps {
  readonly row: ConnectionPanelRow;
  readonly actions: ConnectionPanelActions;
  readonly messages: ConnectionsMessages;
  readonly locale: Locale | undefined;
  readonly slot: Slot;
  readonly unstyled: boolean | undefined;
}

function TargetFields({ row }: { row: ConnectionPanelRow }) {
  return (
    <>
      <input type="hidden" name="provider" value={row.provider} />
      <input type="hidden" name="account" value={row.accountId} />
    </>
  );
}

function ErrorLine({ state, messages, unstyled }: { state: ConnectionFormState; messages: ConnectionsMessages; unstyled: boolean | undefined }) {
  return <FormError message={state.error === undefined ? undefined : getConnectionsErrorMessage(messages, state.error)} unstyled={unstyled} />;
}

function ConnectForm({ row, actions, messages, slot, unstyled }: ItemProps) {
  const [state, dispatch, isPending] = useActionState(actions.start, IDLE);
  const label = row.status === "not_connected" ? messages.actions.connect : messages.actions.reconnect;
  return (
    <form action={dispatch} className={slot("actions")}>
      <TargetFields row={row} />
      <Button type="submit" variant={row.status === "connected" ? "secondary" : "primary"} size="sm" pending={isPending} pendingLabel={messages.actions.connecting} unstyled={unstyled}>
        {label}
      </Button>
      <ErrorLine state={state} messages={messages} unstyled={unstyled} />
    </form>
  );
}

function CredentialForm({ row, actions, messages, locale, slot, unstyled }: ItemProps) {
  const [state, dispatch, isPending] = useActionState(actions.save, IDLE);
  return (
    <form action={dispatch} className={slot("actions")}>
      <TargetFields row={row} />
      <input type="hidden" name="kind" value={row.kind} />
      {row.kind === "basic" && <TextField name="username" label={messages.fields.username} autoComplete="off" required unstyled={unstyled} locale={locale} />}
      <PasswordField
        name={row.kind === "basic" ? "password" : "apiKey"}
        label={row.kind === "basic" ? messages.fields.password : messages.fields.apiKey}
        autoComplete="off"
        unstyled={unstyled}
        locale={locale}
      />
      <Button type="submit" variant="primary" size="sm" pending={isPending} pendingLabel={messages.actions.saving} unstyled={unstyled}>
        {row.status === "not_connected" ? messages.actions.save : messages.actions.replace}
      </Button>
      <ErrorLine state={state} messages={messages} unstyled={unstyled} />
    </form>
  );
}

function DisconnectForm({ row, actions, messages, slot, unstyled }: ItemProps) {
  const [state, dispatch, isPending] = useActionState(actions.disconnect, IDLE);
  return (
    <form action={dispatch} className={slot("actions")}>
      <TargetFields row={row} />
      <Button type="submit" variant="ghost" size="sm" pending={isPending} pendingLabel={messages.actions.disconnecting} unstyled={unstyled}>
        {messages.actions.disconnect}
      </Button>
      <ErrorLine state={state} messages={messages} unstyled={unstyled} />
    </form>
  );
}

function ConnectionItem(props: ItemProps) {
  const { row, slot, unstyled } = props;
  const statusClass = unstyled === true ? slot("status") : `${slot("status") ?? ""} ${STATUS_TONES[row.status]}`;
  return (
    <li className={slot("item")} data-status={row.status}>
      <div className={slot("header")}>
        <p className={slot("title")}>{row.label}</p>
        <span className={statusClass}>{row.statusLabel}</span>
      </div>
      {row.details.length > 0 && (
        <ul className={slot("details")}>
          {row.details.map((line) => (
            <li key={line} className={slot("detail")}>
              {line}
            </li>
          ))}
        </ul>
      )}
      {row.lastError !== null && <p className={slot("detail")}>{row.lastError}</p>}
      {row.hint !== null && <p className={slot("hint")}>{row.hint}</p>}
      {row.kind === "oauth" ? <ConnectForm {...props} /> : <CredentialForm {...props} />}
      {row.status !== "not_connected" && <DisconnectForm {...props} />}
    </li>
  );
}

/** Every declared provider account with its status and actions; the empty state when the app declares none. */
export function ConnectionsPanel({ rows, actions, messages, notice = null, locale, classNames, unstyled }: ConnectionsPanelProps) {
  const slot = createSlotClassGetter({ defaults: DEFAULT_CLASSES, classNames, unstyled });
  return (
    <div className={slot("root")}>
      {notice?.tone === "success" && (
        <p role="status" className={slot("notice")}>
          {notice.text}
        </p>
      )}
      {notice?.tone === "error" && <FormError message={notice.text} unstyled={unstyled} />}
      {rows.length === 0 ? (
        <p className={slot("empty")}>{messages.page.empty}</p>
      ) : (
        <ul className={slot("list")}>
          {rows.map((row) => (
            <ConnectionItem key={`${row.provider}/${row.accountId}`} row={row} actions={actions} messages={messages} locale={locale} slot={slot} unstyled={unstyled} />
          ))}
        </ul>
      )}
    </div>
  );
}
