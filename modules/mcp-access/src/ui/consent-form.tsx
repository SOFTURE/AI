import { formatMessage } from "@softure-ai/core";
import { Button, Checkbox, type ClassNames, createSlotClassGetter } from "@softure-ai/ui";
import type { McpAccessMessages } from "../messages/index.js";

// The OAuth consent screen's body: which app (its registered name and where the code goes, which
// the app cannot fake), which account (two accounts in one browser happen) and what access (read
// always, change only when the client asked, the app allows it and the person ticks it). A plain
// HTML form posting to the decision route, so the `303` to the client works without JavaScript and
// with native app schemes. Server-safe: no hooks.

export type ConsentFormSlot = "root" | "details" | "term" | "value" | "note" | "actions" | "text" | "link";

export interface ConsentFormProps {
  /** The decision route the form posts to. */
  readonly action: string;
  /** The authorization request's parameters, carried in hidden fields. */
  readonly params: readonly (readonly [string, string])[];
  readonly clientName: string;
  /** Where the code goes: the host for http(s), the whole URI for a native scheme. */
  readonly redirectTarget: string;
  readonly accountEmail: string;
  /** Offer the change checkbox: the client asked for `mcp:write` and the app allows writes. */
  readonly isWriteOffered: boolean;
  readonly messages: McpAccessMessages;
  readonly classNames?: ClassNames<ConsentFormSlot>;
  readonly unstyled?: boolean;
}

const DEFAULT_CLASSES: Readonly<Record<ConsentFormSlot, string>> = {
  root: "sft:flex sft:flex-col sft:gap-4 sft:font-sans",
  details: "sft:m-0 sft:flex sft:flex-col sft:gap-3 sft:text-sm",
  term: "sft:text-muted",
  value: "sft:m-0 sft:font-medium sft:text-foreground",
  note: "sft:font-normal sft:text-muted",
  actions: "sft:flex sft:flex-col sft:gap-3",
  text: "sft:m-0 sft:text-sm sft:text-muted",
  link: "sft:font-medium sft:text-accent",
};

export function ConsentForm({ action, params, clientName, redirectTarget, accountEmail, isWriteOffered, messages, classNames, unstyled }: ConsentFormProps) {
  const slot = createSlotClassGetter({ defaults: DEFAULT_CLASSES, classNames, unstyled });
  const copy = messages.consent;
  return (
    <form method="post" action={action} className={slot("root")}>
      {params.map(([name, value]) => (
        <input key={name} type="hidden" name={name} value={value} />
      ))}
      <dl className={slot("details")}>
        <div>
          <dt className={slot("term")}>{copy.app}</dt>
          <dd className={slot("value")}>
            {clientName} <span className={slot("note")}>({formatMessage(copy.returnsTo, { target: redirectTarget })})</span>
          </dd>
        </div>
        <div>
          <dt className={slot("term")}>{copy.account}</dt>
          <dd className={slot("value")}>{accountEmail}</dd>
        </div>
        <div>
          <dt className={slot("term")}>{copy.access}</dt>
          <dd className={slot("value")}>{copy.readAccess}</dd>
        </div>
      </dl>
      {isWriteOffered ? <Checkbox name="canWrite" label={copy.allowWrite} description={copy.allowWriteHint} unstyled={unstyled} /> : null}
      <div className={slot("actions")}>
        <Button type="submit" name="decision" value="allow" variant="primary" size="lg" fullWidth unstyled={unstyled}>
          {copy.allow}
        </Button>
        <Button type="submit" name="decision" value="deny" variant="secondary" size="lg" fullWidth unstyled={unstyled}>
          {copy.deny}
        </Button>
      </div>
    </form>
  );
}

export interface ConsentErrorProps {
  readonly message: string;
  /** The client's redirect URI with the error, when the client was confirmed; a link, never automatic. */
  readonly backLocation?: string;
  readonly backTarget?: string;
  readonly messages: McpAccessMessages;
  readonly classNames?: ClassNames<ConsentFormSlot>;
  readonly unstyled?: boolean;
}

/** Why the request cannot go on. Nothing was granted; going back to the client is the person's click. */
export function ConsentError({ message, backLocation, backTarget, messages, classNames, unstyled }: ConsentErrorProps) {
  const slot = createSlotClassGetter({ defaults: DEFAULT_CLASSES, classNames, unstyled });
  return (
    <div className={slot("root")}>
      <p className={slot("text")}>{message}</p>
      <p className={slot("text")}>{messages.consent.nothingGranted}</p>
      {backLocation === undefined || backTarget === undefined ? null : (
        <p className={slot("text")}>
          <a href={backLocation} className={slot("link")}>
            {formatMessage(messages.consent.backToApp, { target: backTarget })}
          </a>
        </p>
      )}
    </div>
  );
}
