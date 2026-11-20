"use client";

import type { Locale } from "@softure-ai/core";
import { Button, Checkbox, type ClassNames, createSlotClassGetter, FormError, TextField } from "@softure-ai/ui";
import { useActionState } from "react";
import { INITIAL_AUTH_FORM_STATE } from "../contract.js";
import { type AuthMessages, getAuthErrorMessage, getInvitationMessages } from "../messages/index.js";
import type { AuthFormAction } from "./auth-forms.js";

// The invitations panel of the admin page: a form to invite an email with roles, then the sent invitations, each with
// its state and, while it is pending or expired, Resend and Revoke. Every form posts to its server action through
// `useActionState`, so it works without JavaScript; a success redirects back to the page, which reads the list again.
// Copy comes from the module's messages (the page formats dates); styling only from @softure-ai/ui classes.

export type InvitationPanelSlot = "root" | "form" | "roles" | "notice" | "title" | "list" | "item" | "line" | "note" | "actions" | "empty";

/** One invitation as the panel renders it; the page prepares it on the server, copy and dates included. */
export interface InvitationPanelRow {
  readonly id: string;
  /** The email and the state in the app's copy (Pending, Expired, Accepted, Revoked). */
  readonly title: string;
  /** Lines under the email: roles, who sent it and when, until when it works. */
  readonly details: readonly string[];
  /** Pending or expired: it can still be resent or revoked. */
  readonly isOpen: boolean;
}

export interface InvitationPanelProps {
  readonly rows: readonly InvitationPanelRow[];
  /** The roles an invitation may carry: the app's declared roles. */
  readonly roles: readonly string[];
  readonly inviteAction: AuthFormAction;
  readonly resendAction: AuthFormAction;
  readonly revokeAction: AuthFormAction;
  readonly messages: AuthMessages;
  /** A confirmation after the last action, already in the app's copy. */
  readonly notice?: string;
  /** Locale of the built-in copy of the ui primitives. */
  readonly locale?: Locale;
  readonly classNames?: ClassNames<InvitationPanelSlot>;
  readonly unstyled?: boolean;
}

const DEFAULT_CLASSES: Readonly<Record<InvitationPanelSlot, string>> = {
  root: "sft:flex sft:flex-col sft:gap-3 sft:font-sans",
  form: "sft:flex sft:flex-col sft:gap-3",
  roles: "sft:flex sft:flex-col sft:gap-1",
  notice: "sft:m-0 sft:text-sm sft:text-success",
  title: "sft:m-0 sft:font-medium",
  list: "sft:m-0 sft:flex sft:list-none sft:flex-col sft:gap-3 sft:p-0",
  item: "sft:flex sft:flex-col sft:gap-1",
  line: "sft:m-0 sft:text-sm",
  note: "sft:m-0 sft:text-xs sft:text-muted",
  actions: "sft:flex sft:gap-2",
  empty: "sft:m-0 sft:text-sm sft:text-muted",
};

type Slot = (part: InvitationPanelSlot) => string | undefined;

function InviteForm({ action, roles, messages, locale, slot, unstyled }: {
  action: AuthFormAction;
  roles: readonly string[];
  messages: AuthMessages;
  locale: Locale | undefined;
  slot: Slot;
  unstyled: boolean | undefined;
}) {
  const [state, formAction, isPending] = useActionState(action, INITIAL_AUTH_FORM_STATE);
  const copy = getInvitationMessages(messages);
  const error = state.error === undefined ? undefined : getAuthErrorMessage(messages, state.error);
  return (
    <form action={formAction} className={slot("form")}>
      <TextField
        name="email"
        type="email"
        label={copy.email}
        autoComplete="off"
        required
        defaultValue={state.email ?? ""}
        error={state.field === "email" ? error : undefined}
        locale={locale}
        unstyled={unstyled}
      />
      <fieldset className={slot("roles")}>
        <legend className={slot("title")}>{copy.roles}</legend>
        {roles.map((role) => (
          <Checkbox key={role} name={`role-${role}`} label={role} unstyled={unstyled} />
        ))}
      </fieldset>
      <FormError message={state.field === "email" ? undefined : error} unstyled={unstyled} />
      <Button type="submit" variant="primary" pending={isPending} pendingLabel={copy.pending} unstyled={unstyled}>
        {copy.submit}
      </Button>
    </form>
  );
}

function RowAction({ id, action, label, variant, messages, unstyled }: {
  id: string;
  action: AuthFormAction;
  label: string;
  variant: "secondary" | "danger";
  messages: AuthMessages;
  unstyled: boolean | undefined;
}) {
  const [state, formAction, isPending] = useActionState(action, INITIAL_AUTH_FORM_STATE);
  return (
    <form action={formAction}>
      <input type="hidden" name="id" value={id} />
      <Button type="submit" size="sm" variant={variant} pending={isPending} unstyled={unstyled}>
        {label}
      </Button>
      <FormError message={state.error === undefined ? undefined : getAuthErrorMessage(messages, state.error)} unstyled={unstyled} />
    </form>
  );
}

/** The invite form and the sent invitations, newest first; the empty state when there are none. */
export function InvitationPanel(props: InvitationPanelProps) {
  const { rows, roles, inviteAction, resendAction, revokeAction, messages, notice, locale, classNames, unstyled } = props;
  const slot = createSlotClassGetter({ defaults: DEFAULT_CLASSES, classNames, unstyled });
  const copy = getInvitationMessages(messages);
  return (
    <div className={slot("root")}>
      {notice === undefined ? null : (
        <p role="status" className={slot("notice")}>
          {notice}
        </p>
      )}
      <InviteForm action={inviteAction} roles={roles} messages={messages} locale={locale} slot={slot} unstyled={unstyled} />
      <section aria-label={copy.listTitle} className={slot("form")}>
        <p className={slot("title")}>{copy.listTitle}</p>
        {rows.length === 0 ? (
          <p className={slot("empty")}>{copy.empty}</p>
        ) : (
          <ul className={slot("list")}>
            {rows.map((row) => (
              <li key={row.id} className={slot("item")}>
                <p className={slot("line")}>{row.title}</p>
                {row.details.map((detail) => (
                  <p key={detail} className={slot("note")}>
                    {detail}
                  </p>
                ))}
                {row.isOpen ? (
                  <div className={slot("actions")}>
                    <RowAction id={row.id} action={resendAction} label={copy.resend} variant="secondary" messages={messages} unstyled={unstyled} />
                    <RowAction id={row.id} action={revokeAction} label={copy.revoke} variant="danger" messages={messages} unstyled={unstyled} />
                  </div>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
