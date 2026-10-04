"use client";

import type { Locale } from "@softure-ai/core";
import { Button, type ClassNames, createSlotClassGetter, FormError, TextField } from "@softure-ai/ui";
import { useActionState } from "react";
import { INITIAL_ADMIN_ACTION_STATE } from "../contract.js";
import { EMAIL_FIELD, GRANT_FIELD } from "../fields.js";
import { getBillingErrorMessage, type BillingMessages } from "../messages/index.js";
import type { AdminAction } from "./payment-requests.js";

// The admin page's account history: a lookup by email (its action sends the admin to the page with
// the account's id, so no address lands in a URL) and the account's manual grants and provider
// payments, newest first, with a Revoke button on each active manual grant. Rows come prepared
// from the server; the revoke action checks the admin role first and refreshes the page.

export type GrantHistorySlot = "root" | "empty" | "item" | "itemHeader" | "title" | "status" | "details";

/** One grant or payment, prepared on the server. */
export interface GrantHistoryRow {
  readonly id: string;
  /** The plan and where it came from, e.g. "Monthly, granted by hand". */
  readonly title: string;
  /** "Active", "Revoked on …", "Paid", "Refunded on …". */
  readonly statusText: string;
  /** Whether it still gives access (active or paid); the rest is drawn muted. */
  readonly isCurrent: boolean;
  /** The date, the access it added and the amount, one line each. */
  readonly details: readonly string[];
  /** Set for an active manual grant: the accessible name of its Revoke button. */
  readonly revokeLabel: string | null;
}

export interface GrantHistoryProps {
  readonly rows: readonly GrantHistoryRow[];
  readonly revokeAction: AdminAction;
  readonly messages: BillingMessages;
  readonly classNames?: ClassNames<GrantHistorySlot>;
  readonly unstyled?: boolean;
}

const DEFAULT_CLASSES: Readonly<Record<GrantHistorySlot, string>> = {
  root: "sft:m-0 sft:flex sft:list-none sft:flex-col sft:gap-3 sft:p-0 sft:font-sans",
  empty: "sft:m-0 sft:font-sans sft:text-sm sft:text-muted",
  item: "sft:flex sft:flex-col sft:gap-1 sft:border-t sft:border-border sft:pt-3 sft:first-of-type:border-t-0 sft:first-of-type:pt-0",
  itemHeader: "sft:flex sft:items-center sft:justify-between sft:gap-2",
  title: "sft:m-0 sft:text-sm sft:font-semibold sft:text-foreground",
  status: "sft:text-xs sft:font-medium sft:text-success",
  details: "sft:m-0 sft:text-xs sft:text-muted",
};

type Slot = (part: GrantHistorySlot) => string | undefined;

function HistoryItem({ row, revokeAction, messages, slot, unstyled }: { row: GrantHistoryRow; revokeAction: AdminAction; messages: BillingMessages; slot: Slot; unstyled: boolean | undefined }) {
  const [state, formAction, isPending] = useActionState(revokeAction, INITIAL_ADMIN_ACTION_STATE);
  const copy = messages.admin.history;
  return (
    <li className={slot("item")} data-history-id={row.id}>
      <div className={slot("itemHeader")}>
        <p className={slot("title")}>{row.title}</p>
        {row.revokeLabel === null ? null : (
          <form action={formAction}>
            <input type="hidden" name={GRANT_FIELD} value={row.id} />
            <Button type="submit" variant="danger" size="sm" pending={isPending} aria-label={row.revokeLabel} unstyled={unstyled}>
              {isPending ? copy.revoking : copy.revoke}
            </Button>
          </form>
        )}
      </div>
      <p className={row.isCurrent ? slot("status") : slot("details")}>{row.statusText}</p>
      {row.details.map((line) => (
        <p key={line} className={slot("details")}>
          {line}
        </p>
      ))}
      <FormError message={state.status === "error" ? getBillingErrorMessage(messages, state.error) : undefined} unstyled={unstyled} />
    </li>
  );
}

export function GrantHistory({ rows, revokeAction, messages, classNames, unstyled }: GrantHistoryProps) {
  const slot = createSlotClassGetter({ defaults: DEFAULT_CLASSES, classNames, unstyled });
  if (rows.length === 0) return <p className={slot("empty")}>{messages.admin.history.empty}</p>;
  return (
    <ul className={slot("root")} aria-label={messages.admin.history.title}>
      {rows.map((row) => (
        <HistoryItem key={row.id} row={row} revokeAction={revokeAction} messages={messages} slot={slot} unstyled={unstyled} />
      ))}
    </ul>
  );
}

export type AccountLookupSlot = "root";

export interface AccountLookupProps {
  readonly action: AdminAction;
  readonly messages: BillingMessages;
  /** Locale of the built-in copy of the ui primitives. */
  readonly locale?: Locale;
  readonly classNames?: ClassNames<AccountLookupSlot>;
  readonly unstyled?: boolean;
}

/** The email lookup of the history card; a found account reloads the page on its history. */
export function AccountLookup({ action, messages, locale, classNames, unstyled }: AccountLookupProps) {
  const [state, formAction, isPending] = useActionState(action, INITIAL_ADMIN_ACTION_STATE);
  const slot = createSlotClassGetter<AccountLookupSlot>({ defaults: { root: "sft:flex sft:flex-col sft:gap-3 sft:font-sans" }, classNames, unstyled });
  const copy = messages.admin.history;
  const error = state.status === "error" ? getBillingErrorMessage(messages, state.error) : undefined;
  return (
    <form action={formAction} className={slot("root")}>
      <TextField
        key={state.status === "error" ? `error:${state.email ?? ""}` : "lookup"}
        name={EMAIL_FIELD}
        type="email"
        label={copy.email}
        required
        defaultValue={state.status === "error" ? (state.email ?? "") : ""}
        error={error}
        locale={locale}
        unstyled={unstyled}
      />
      <Button type="submit" variant="secondary" pending={isPending} unstyled={unstyled}>
        {isPending ? copy.pending : copy.submit}
      </Button>
    </form>
  );
}
