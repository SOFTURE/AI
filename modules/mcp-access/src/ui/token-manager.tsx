"use client";

import { formatMessage, type Locale } from "@softure-ai/core";
import { Button, ButtonLink, Checkbox, type ClassNames, createSlotClassGetter, FormError, TextField } from "@softure-ai/ui";
import { useActionState, useState } from "react";
import type { IssuedToken, IssueTokenFormState, RevokeTokenFormState } from "../contract.js";
import { getTokenErrorMessage, type McpAccessMessages } from "../messages/index.js";
import { MAX_TOKEN_NAME_LENGTH } from "../options.js";

// The token page's client part: the tool catalog, the issue form, the token just issued with its
// setup snippets, and the owner's tokens with a revoke button each. Both forms submit to their
// server actions through `useActionState`. The plaintext lives only in the issue form's state:
// "Done" or leaving the page drops it. Copy comes from the module's messages; styling only from
// @softure-ai/ui classes.

export type IssueTokenAction = (previous: IssueTokenFormState, formData: FormData) => Promise<IssueTokenFormState>;
export type RevokeTokenAction = (previous: RevokeTokenFormState, formData: FormData) => Promise<RevokeTokenFormState>;

export type TokenManagerSlot = "root" | "section" | "heading" | "text" | "list" | "item" | "itemHeader" | "badge" | "details" | "snippet" | "code";

/** One tool of the app's catalog, prepared on the server. */
export interface TokenManagerTool {
  readonly name: string;
  readonly description: string;
  /** "Reads", "Changes data", or that writes are off, already in the app's copy. */
  readonly accessText: string;
}

/** One of the owner's tokens, prepared on the server. */
export interface TokenManagerRow {
  readonly id: string;
  readonly name: string;
  /** Read only, or read and change, already in the app's copy. */
  readonly scopeText: string;
  /** Active, expiring in n days, or expired. */
  readonly statusText: string;
  readonly isExpired: boolean;
  /** Created, valid until and last used, already formatted. */
  readonly details: readonly string[];
}

export interface TokenManagerProps {
  readonly tools: readonly TokenManagerTool[];
  readonly tokens: readonly TokenManagerRow[];
  /** Offers write tokens; off, every token reads only. */
  readonly allowWrites: boolean;
  /** The per-account limit, for the form's note. */
  readonly maxTokens: number;
  readonly issueAction: IssueTokenAction;
  readonly revokeAction: RevokeTokenAction;
  readonly messages: McpAccessMessages;
  /** Locale of the built-in copy of the ui primitives. */
  readonly locale?: Locale;
  readonly classNames?: ClassNames<TokenManagerSlot>;
  readonly unstyled?: boolean;
}

const DEFAULT_CLASSES: Readonly<Record<TokenManagerSlot, string>> = {
  root: "sft:flex sft:flex-col sft:gap-4 sft:font-sans",
  section: "sft:flex sft:flex-col sft:gap-3 sft:border-t sft:border-border sft:pt-4 sft:first-of-type:border-t-0 sft:first-of-type:pt-0",
  heading: "sft:m-0 sft:text-base sft:font-semibold sft:text-foreground",
  text: "sft:m-0 sft:text-sm sft:text-muted",
  list: "sft:m-0 sft:flex sft:list-none sft:flex-col sft:gap-3 sft:p-0",
  item: "sft:flex sft:flex-col sft:gap-1",
  itemHeader: "sft:flex sft:items-center sft:justify-between sft:gap-2",
  badge: "sft:text-xs sft:font-medium sft:text-muted",
  details: "sft:m-0 sft:text-xs sft:text-muted",
  snippet: "sft:flex sft:flex-col sft:gap-1.5",
  code: "sft:m-0 sft:block sft:overflow-x-auto sft:whitespace-normal sft:break-words sft:rounded-control sft:border sft:border-border sft:bg-surface-raised sft:p-4 sft:font-mono sft:text-xs sft:text-foreground",
};

type Slot = (part: TokenManagerSlot) => string | undefined;

/** A labelled snippet with a copy button. */
function Snippet({ title, value, messages, slot, unstyled }: { title: string; value: string; messages: McpAccessMessages; slot: Slot; unstyled: boolean | undefined }) {
  const [isCopied, setIsCopied] = useState(false);
  function copy() {
    void navigator.clipboard.writeText(value).then(
      () => setIsCopied(true),
      // Clipboard access can be refused; the text stays on screen to select by hand.
      () => setIsCopied(false),
    );
  }
  return (
    <div className={slot("snippet")}>
      <div className={slot("itemHeader")}>
        <p className={slot("heading")}>{title}</p>
        <Button variant="secondary" size="sm" onClick={copy} unstyled={unstyled}>
          {isCopied ? messages.issued.copied : messages.issued.copy}
        </Button>
      </div>
      <pre className={slot("code")}>{value}</pre>
    </div>
  );
}

function IssuedTokenPanel({
  issued,
  onDone,
  messages,
  slot,
  unstyled,
}: {
  issued: IssuedToken;
  onDone: () => void;
  messages: McpAccessMessages;
  slot: Slot;
  unstyled: boolean | undefined;
}) {
  const snippet = (title: string, value: string) => <Snippet title={title} value={value} messages={messages} slot={slot} unstyled={unstyled} />;
  return (
    <section className={slot("section")}>
      <h3 className={slot("heading")}>{formatMessage(messages.issued.title, { name: issued.name })}</h3>
      <p className={slot("text")}>{messages.issued.once}</p>
      <p className={slot("text")}>
        {issued.expiresText} {issued.canWrite ? messages.issued.readWrite : messages.issued.readOnly}
      </p>
      {snippet(messages.issued.promptTitle, issued.setup.assistantPrompt)}
      <p className={slot("text")}>{messages.issued.promptHint}</p>
      <ButtonLink href={issued.setup.claudeCodeLink} variant="secondary" size="sm" unstyled={unstyled}>
        {messages.issued.openClaudeCode}
      </ButtonLink>
      {snippet(messages.issued.commandTitle, issued.setup.claudeCodeCommand)}
      {snippet(messages.issued.jsonTitle, issued.setup.jsonConfig)}
      {snippet(messages.issued.desktopTitle, issued.setup.desktopConfig)}
      {snippet(messages.issued.headerTitle, `${issued.setup.endpointUrl}\nAuthorization: ${issued.setup.authorizationHeader}`)}
      <Button variant="primary" onClick={onDone} unstyled={unstyled}>
        {messages.issued.done}
      </Button>
    </section>
  );
}

function IssueForm({
  action,
  allowWrites,
  maxTokens,
  messages,
  locale,
  slot,
  unstyled,
}: {
  action: IssueTokenAction;
  allowWrites: boolean;
  maxTokens: number;
  messages: McpAccessMessages;
  locale: Locale | undefined;
  slot: Slot;
  unstyled: boolean | undefined;
}) {
  const [state, formAction, isPending] = useActionState(action, { status: "idle" });
  // The id of the issued token the owner dismissed; a new one shows again.
  const [dismissedId, setDismissedId] = useState<string | null>(null);
  const issued = state.status === "ok" && state.issued.id !== dismissedId ? state.issued : null;
  return (
    <>
      <section className={slot("section")}>
        <h2 className={slot("heading")}>{messages.issue.title}</h2>
        <form action={formAction} className={slot("list")}>
          <TextField
            name="name"
            label={messages.issue.name}
            hint={messages.issue.nameHint}
            maxLength={MAX_TOKEN_NAME_LENGTH}
            required
            autoComplete="off"
            locale={locale}
            unstyled={unstyled}
          />
          {allowWrites ? <Checkbox name="canWrite" label={messages.issue.canWrite} description={messages.issue.canWriteHint} unstyled={unstyled} /> : null}
          <p className={slot("text")}>{formatMessage(messages.issue.limit, { max: maxTokens })}</p>
          <FormError message={state.status === "error" ? getTokenErrorMessage(messages, state.error) : undefined} unstyled={unstyled} />
          <Button type="submit" variant="primary" pending={isPending} unstyled={unstyled}>
            {isPending ? messages.issue.pending : messages.issue.submit}
          </Button>
        </form>
      </section>
      {issued === null ? null : <IssuedTokenPanel issued={issued} onDone={() => setDismissedId(issued.id)} messages={messages} slot={slot} unstyled={unstyled} />}
    </>
  );
}

function TokenItem({
  row,
  action,
  messages,
  slot,
  unstyled,
}: {
  row: TokenManagerRow;
  action: RevokeTokenAction;
  messages: McpAccessMessages;
  slot: Slot;
  unstyled: boolean | undefined;
}) {
  const [state, formAction, isPending] = useActionState(action, { status: "idle" });
  return (
    <li className={slot("item")} data-token-id={row.id}>
      <div className={slot("itemHeader")}>
        <p className={slot("heading")}>{row.name}</p>
        <form action={formAction}>
          <input type="hidden" name="id" value={row.id} />
          <Button type="submit" variant="danger" size="sm" pending={isPending} aria-label={`${messages.list.revoke}: ${row.name}`} unstyled={unstyled}>
            {isPending ? messages.list.revoking : messages.list.revoke}
          </Button>
        </form>
      </div>
      <p className={row.isExpired ? slot("details") : slot("badge")}>
        {row.statusText} · {row.scopeText}
      </p>
      <p className={slot("details")}>{row.details.join(" · ")}</p>
      <FormError message={state.status === "error" ? getTokenErrorMessage(messages, state.error) : undefined} unstyled={unstyled} />
    </li>
  );
}

export function TokenManager({ tools, tokens, allowWrites, maxTokens, issueAction, revokeAction, messages, locale, classNames, unstyled }: TokenManagerProps) {
  const slot = createSlotClassGetter({ defaults: DEFAULT_CLASSES, classNames, unstyled });
  return (
    <div className={slot("root")}>
      <section className={slot("section")}>
        <h2 className={slot("heading")}>{messages.tools.title}</h2>
        {tools.length === 0 ? (
          <p className={slot("text")}>{messages.tools.empty}</p>
        ) : (
          <ul className={slot("list")}>
            {tools.map((tool) => (
              <li key={tool.name} className={slot("item")}>
                <div className={slot("itemHeader")}>
                  <code className={slot("heading")}>{tool.name}</code>
                  <span className={slot("badge")}>{tool.accessText}</span>
                </div>
                <p className={slot("text")}>{tool.description}</p>
              </li>
            ))}
          </ul>
        )}
      </section>
      <IssueForm action={issueAction} allowWrites={allowWrites} maxTokens={maxTokens} messages={messages} locale={locale} slot={slot} unstyled={unstyled} />
      <section className={slot("section")}>
        <h2 className={slot("heading")}>{messages.list.title}</h2>
        {tokens.length === 0 ? (
          <p className={slot("text")}>{messages.list.empty}</p>
        ) : (
          <ul className={slot("list")}>
            {tokens.map((row) => (
              <TokenItem key={row.id} row={row} action={revokeAction} messages={messages} slot={slot} unstyled={unstyled} />
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
