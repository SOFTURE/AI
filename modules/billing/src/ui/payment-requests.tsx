"use client";

import { Button, ButtonLink, type ClassNames, createSlotClassGetter, FormError, type LinkComponentType } from "@softure-ai/ui";
import { useActionState } from "react";
import { INITIAL_ADMIN_ACTION_STATE, type AdminActionState } from "../contract.js";
import { REQUEST_FIELD } from "../fields.js";
import { getBillingErrorMessage, type BillingMessages } from "../messages/index.js";

// The admin page's open invoice requests, each with a Grant and a Dismiss button and a link to its
// account's history. Rows come prepared from the server (copy and dates in the app's locale); each
// button submits its row's id to its server action, which checks the admin role first and refreshes
// the page, so a granted or dismissed request leaves the list.

export type AdminAction = (previous: AdminActionState, formData: FormData) => Promise<AdminActionState>;

export type PaymentRequestListSlot = "root" | "empty" | "item" | "itemHeader" | "title" | "details" | "actions";

/** One open request, prepared on the server. */
export interface PaymentRequestRow {
  readonly id: string;
  /** The account's email and the plan, e.g. "ada@example.com · Monthly". */
  readonly title: string;
  /** When it was asked for and the invoice details, one line each. */
  readonly details: readonly string[];
  /** The admin page showing this account's history. */
  readonly historyHref: string;
  /** Accessible names of the buttons, naming the request. */
  readonly grantLabel: string;
  readonly dismissLabel: string;
}

export interface PaymentRequestListProps {
  readonly requests: readonly PaymentRequestRow[];
  readonly grantAction: AdminAction;
  readonly dismissAction: AdminAction;
  readonly messages: BillingMessages;
  /** The app's link component, e.g. Next's `Link`; a plain `<a>` when omitted. */
  readonly LinkComponent?: LinkComponentType;
  readonly classNames?: ClassNames<PaymentRequestListSlot>;
  readonly unstyled?: boolean;
}

const DEFAULT_CLASSES: Readonly<Record<PaymentRequestListSlot, string>> = {
  root: "sft:m-0 sft:flex sft:list-none sft:flex-col sft:gap-3 sft:p-0 sft:font-sans",
  empty: "sft:m-0 sft:font-sans sft:text-sm sft:text-muted",
  item: "sft:flex sft:flex-col sft:gap-1 sft:border-t sft:border-border sft:pt-3 sft:first-of-type:border-t-0 sft:first-of-type:pt-0",
  itemHeader: "sft:flex sft:items-center sft:justify-between sft:gap-2",
  title: "sft:m-0 sft:text-sm sft:font-semibold sft:text-foreground",
  details: "sft:m-0 sft:text-xs sft:text-muted",
  actions: "sft:flex sft:items-center sft:gap-2",
};

type Slot = (part: PaymentRequestListSlot) => string | undefined;

function RequestItem({
  row,
  grantAction,
  dismissAction,
  messages,
  LinkComponent,
  slot,
  unstyled,
}: {
  row: PaymentRequestRow;
  grantAction: AdminAction;
  dismissAction: AdminAction;
  messages: BillingMessages;
  LinkComponent: LinkComponentType | undefined;
  slot: Slot;
  unstyled: boolean | undefined;
}) {
  const [granted, grant, isGranting] = useActionState(grantAction, INITIAL_ADMIN_ACTION_STATE);
  const [dismissed, dismiss, isDismissing] = useActionState(dismissAction, INITIAL_ADMIN_ACTION_STATE);
  const copy = messages.admin.requests;
  const failed = granted.status === "error" ? granted : dismissed.status === "error" ? dismissed : null;
  const isPending = isGranting || isDismissing;
  return (
    <li className={slot("item")} data-request-id={row.id}>
      <p className={slot("title")}>{row.title}</p>
      {row.details.map((line) => (
        <p key={line} className={slot("details")}>
          {line}
        </p>
      ))}
      <div className={slot("actions")}>
        <form action={grant}>
          <input type="hidden" name={REQUEST_FIELD} value={row.id} />
          <Button type="submit" variant="primary" size="sm" pending={isGranting} disabled={isPending} aria-label={row.grantLabel} unstyled={unstyled}>
            {isGranting ? copy.granting : copy.grant}
          </Button>
        </form>
        <form action={dismiss}>
          <input type="hidden" name={REQUEST_FIELD} value={row.id} />
          <Button type="submit" variant="ghost" size="sm" pending={isDismissing} disabled={isPending} aria-label={row.dismissLabel} unstyled={unstyled}>
            {isDismissing ? copy.dismissing : copy.dismiss}
          </Button>
        </form>
        <ButtonLink href={row.historyHref} variant="ghost" size="sm" LinkComponent={LinkComponent} unstyled={unstyled}>
          {copy.history}
        </ButtonLink>
      </div>
      <FormError message={failed === null ? undefined : getBillingErrorMessage(messages, failed.error)} unstyled={unstyled} />
    </li>
  );
}

export function PaymentRequestList({ requests, grantAction, dismissAction, messages, LinkComponent, classNames, unstyled }: PaymentRequestListProps) {
  const slot = createSlotClassGetter({ defaults: DEFAULT_CLASSES, classNames, unstyled });
  if (requests.length === 0) return <p className={slot("empty")}>{messages.admin.requests.empty}</p>;
  return (
    <ul className={slot("root")} aria-label={messages.admin.requests.title}>
      {requests.map((row) => (
        <RequestItem
          key={row.id}
          row={row}
          grantAction={grantAction}
          dismissAction={dismissAction}
          messages={messages}
          LinkComponent={LinkComponent}
          slot={slot}
          unstyled={unstyled}
        />
      ))}
    </ul>
  );
}
