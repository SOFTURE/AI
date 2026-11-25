"use client";

import { formatMessage, type Locale } from "@softure-ai/core";
import { Button, Checkbox, type ClassNames, createSlotClassGetter, FormError, Modal, ModalBody, ModalFooter, type ModalSlot, TextField } from "@softure-ai/ui";
import { type MouseEvent, useActionState, useRef, useState } from "react";
import { INITIAL_AUTH_FORM_STATE } from "../contract.js";
import { type AuthMessages, getAuthErrorMessage, getInvitationMessages } from "../messages/index.js";
import type { AuthFormAction } from "./auth-forms.js";

// The invitations panel of the admin page: a form to invite an email with roles, then the sent invitations, each with
// its state and, while it is pending or expired, Resend and Revoke. Every form posts to its server action through
// `useActionState`, so it works without JavaScript; a success redirects back to the page, which reads the list again.
// With JavaScript, Revoke first asks in a dialog; its confirm submits the row's form, so the action path is the same.
// Copy comes from the module's messages (the page formats dates); styling only from @softure-ai/ui classes.

export type InvitationPanelSlot = "root" | "form" | "roles" | "notice" | "title" | "list" | "item" | "line" | "note" | "actions" | "action" | "empty";

/** One invitation as the panel renders it; the page prepares it on the server, copy and dates included. */
export interface InvitationPanelRow {
  readonly id: string;
  /** The invited email, named in the revoke confirmation's title. */
  readonly email?: string;
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
  /** The revoke confirmation's slots (`overlay`, `panel`, `close`…), for the app's dialog look. */
  readonly modalClassNames?: ClassNames<ModalSlot>;
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
  action: "sft:min-h-11 sft:md:min-h-0",
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

interface RowActionProps {
  readonly id: string;
  readonly action: AuthFormAction;
  readonly label: string;
  readonly messages: AuthMessages;
  readonly slot: Slot;
  readonly unstyled: boolean | undefined;
}

function RowAction({ id, action, label, messages, slot, unstyled }: RowActionProps) {
  const [state, formAction, isPending] = useActionState(action, INITIAL_AUTH_FORM_STATE);
  return (
    <form action={formAction}>
      <input type="hidden" name="id" value={id} />
      <Button type="submit" size="sm" variant="secondary" pending={isPending} className={slot("action")} unstyled={unstyled}>
        {label}
      </Button>
      <FormError message={state.error === undefined ? undefined : getAuthErrorMessage(messages, state.error)} unstyled={unstyled} />
    </form>
  );
}

/**
 * Revoke behind a confirmation. The button stays the form's submit button, so without JavaScript it revokes at once;
 * with JavaScript its click opens the dialog, and the dialog's Revoke submits the form.
 */
function RevokeAction({ id, email, action, messages, locale, slot, modalClassNames, unstyled }: Omit<RowActionProps, "label"> & {
  readonly email: string | undefined;
  readonly locale: Locale | undefined;
  readonly modalClassNames: ClassNames<ModalSlot> | undefined;
}) {
  const [state, formAction, isPending] = useActionState(action, INITIAL_AUTH_FORM_STATE);
  const [isConfirming, setIsConfirming] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);
  const copy = getInvitationMessages(messages);
  const title = email === undefined ? copy.revokeTitleUnnamed : formatMessage(copy.revokeTitle, { email });

  function openConfirmation(event: MouseEvent<HTMLButtonElement>) {
    event.preventDefault();
    if (!isPending) setIsConfirming(true);
  }

  function confirm() {
    setIsConfirming(false);
    // The form's Revoke button is the submitter: the submit its click would have sent, without the click itself.
    const form = formRef.current;
    form?.requestSubmit(form.querySelector<HTMLButtonElement>("button[type=submit]"));
  }

  return (
    <form ref={formRef} action={formAction}>
      <input type="hidden" name="id" value={id} />
      <Button
        type="submit"
        size="sm"
        variant="danger"
        pending={isPending}
        aria-haspopup="dialog"
        onClick={openConfirmation}
        className={slot("action")}
        unstyled={unstyled}
      >
        {copy.revoke}
      </Button>
      <FormError message={state.error === undefined ? undefined : getAuthErrorMessage(messages, state.error)} unstyled={unstyled} />
      {isConfirming ? (
        <Modal title={title} width="confirmation" onClose={() => setIsConfirming(false)} locale={locale} classNames={modalClassNames} unstyled={unstyled}>
          <ModalBody unstyled={unstyled}>
            <p className={slot("line")}>{copy.revokeBody}</p>
          </ModalBody>
          <ModalFooter onCancel={() => setIsConfirming(false)} locale={locale} unstyled={unstyled}>
            <Button type="button" variant="danger" onClick={confirm} unstyled={unstyled}>
              {copy.revokeConfirm}
            </Button>
          </ModalFooter>
        </Modal>
      ) : null}
    </form>
  );
}

/** The invite form and the sent invitations, newest first; the empty state when there are none. */
export function InvitationPanel(props: InvitationPanelProps) {
  const { rows, roles, inviteAction, resendAction, revokeAction, messages, notice, locale, classNames, modalClassNames, unstyled } = props;
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
                    <RowAction id={row.id} action={resendAction} label={copy.resend} messages={messages} slot={slot} unstyled={unstyled} />
                    <RevokeAction
                      id={row.id}
                      email={row.email}
                      action={revokeAction}
                      messages={messages}
                      locale={locale}
                      slot={slot}
                      modalClassNames={modalClassNames}
                      unstyled={unstyled}
                    />
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
