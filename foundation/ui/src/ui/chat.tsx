"use client";

import { type FormEvent, type KeyboardEvent, type ReactNode, useId, useState } from "react";
import { Button } from "./button.js";
import { type ClassNames, createSlotClassGetter } from "./class-names.js";
import { type CopyProps, getCopy } from "./copy.js";
import { RefreshIcon } from "./icons.js";
import { useUiCopyProps } from "./locale.js";

// The building blocks of a chat screen on the --sft-* tokens. They take plain props and know nothing
// of AI SDK: an app maps `useChat`'s message parts to them (README, "Chat"). Text renders as React text, never as
// HTML; a tool's output renders through the app's own component, after the app validated it.
//
// Screen readers: a streamed answer would be read token by token from a live list, so the log keeps `role="log"`
// and `aria-busy` while streaming but is not live itself (`aria-live="off"`). A separate polite status region reads
// the finished answer once (`announcement`, filled only when streaming has ended).

/** Who wrote a message. */
export type ChatRole = "user" | "assistant" | "system";

/** A message's state: still streaming, finished, or failed. */
export type ChatMessageStatus = "streaming" | "done" | "error";

/** The chat request's state, with the values of AI SDK's `useChat().status`. */
export type ChatStatus = "ready" | "submitted" | "streaming" | "error";

/** A tool call's state: running, finished with output, or failed. */
export type ToolCallState = "pending" | "done" | "error";

// ChatLog

export type ChatLogSlot = "root" | "log" | "list" | "announcer";

export interface ChatLogProps extends CopyProps<"chat"> {
  /** The messages: `ChatMessage` items, oldest first. */
  readonly children?: ReactNode;
  /** True while an answer streams: the log is `aria-busy` and announces nothing. */
  readonly isStreaming?: boolean;
  /** Plain text read once the answer has finished, usually the last answer's text; nothing is read while streaming. */
  readonly announcement?: string;
  /** The log's accessible name; `messages.logLabel` by default. */
  readonly label?: string;
  readonly classNames?: ClassNames<ChatLogSlot>;
  readonly unstyled?: boolean;
}

/** The message list of a chat: a `role="log"` that announces finished answers, not streamed tokens. */
export function ChatLog({ children, isStreaming = false, announcement, label, classNames, unstyled, locale, messages }: ChatLogProps) {
  const copy = getCopy("chat", useUiCopyProps("chat", { locale, messages }));
  const slot = createSlotClassGetter<ChatLogSlot>({
    defaults: {
      root: "sft:font-sans",
      log: "",
      list: "sft:m-0 sft:flex sft:list-none sft:flex-col sft:gap-4 sft:p-0",
      announcer: "sft:sr-only",
    },
    classNames,
    unstyled,
  });
  return (
    <div className={slot("root")} data-streaming={isStreaming ? "" : undefined}>
      <div role="log" aria-label={label ?? copy.logLabel} aria-live="off" aria-busy={isStreaming} className={slot("log")}>
        <ol className={slot("list")}>{children}</ol>
      </div>
      <div role="status" aria-live="polite" aria-atomic="true" className={slot("announcer")}>
        {isStreaming ? "" : (announcement ?? "")}
      </div>
    </div>
  );
}

// ChatMessage

export type ChatMessageSlot = "root" | "label" | "bubble" | "typing" | "meta" | "actions";

export interface ChatMessageProps extends CopyProps<"chat"> {
  readonly role: ChatRole;
  /** The message's content: text, tool cards, reasoning; empty while the first tokens are on their way. */
  readonly children?: ReactNode;
  /** `done` by default; `streaming` with no content shows a typing indicator. */
  readonly status?: ChatMessageStatus;
  /** The author's name instead of the role's (`messages.roles`). */
  readonly name?: string;
  /** A line under the message, e.g. the cost or the time. */
  readonly meta?: ReactNode;
  /** Actions on the message, e.g. copy or retry. */
  readonly actions?: ReactNode;
  readonly classNames?: ClassNames<ChatMessageSlot>;
  readonly unstyled?: boolean;
}

function isEmptyContent(children: ReactNode): boolean {
  if (children === undefined || children === null || children === false || children === "") return true;
  return Array.isArray(children) && children.every((child) => isEmptyContent(child as ReactNode));
}

/** One message of a `ChatLog`, styled per role (`data-role`) and state (`data-status`). */
export function ChatMessage({
  role,
  children,
  status = "done",
  name,
  meta,
  actions,
  classNames,
  unstyled,
  locale,
  messages,
}: ChatMessageProps) {
  const copy = getCopy("chat", useUiCopyProps("chat", { locale, messages }));
  const slot = createSlotClassGetter<ChatMessageSlot>({
    defaults: {
      root: "sft:flex sft:flex-col sft:items-start sft:gap-1 sft:data-[role=user]:items-end",
      label: "sft:m-0 sft:text-xs sft:font-semibold sft:text-muted",
      bubble:
        "sft:box-border sft:max-w-[85%] sft:rounded-card sft:border sft:border-border sft:bg-surface sft:px-4 sft:py-3 sft:text-base sft:leading-relaxed sft:text-foreground sft:break-words sft:whitespace-pre-wrap sft:in-data-[role=user]:bg-surface-raised sft:in-data-[role=system]:border-dashed sft:in-data-[role=system]:text-muted sft:in-data-[status=error]:border-danger/50",
      typing: "sft:inline-flex sft:items-center sft:gap-1 sft:py-1",
      meta: "sft:text-xs sft:text-muted",
      actions: "sft:flex sft:flex-wrap sft:items-center sft:gap-2",
    },
    classNames,
    unstyled,
  });
  const isTyping = status === "streaming" && isEmptyContent(children);
  return (
    <li data-role={role} data-status={status} className={slot("root")}>
      <p className={slot("label")}>{name ?? copy.roles[role]}</p>
      <div className={slot("bubble")}>
        {isTyping ? (
          <span className={slot("typing")}>
            <span aria-hidden="true" className={unstyled === true ? undefined : TYPING_DOT} />
            <span aria-hidden="true" className={unstyled === true ? undefined : `${TYPING_DOT} sft:[animation-delay:150ms]`} />
            <span aria-hidden="true" className={unstyled === true ? undefined : `${TYPING_DOT} sft:[animation-delay:300ms]`} />
            <span className="sft:sr-only">{copy.typing}</span>
          </span>
        ) : (
          children
        )}
      </div>
      {meta === undefined || meta === null ? null : <div className={slot("meta")}>{meta}</div>}
      {actions === undefined || actions === null ? null : <div className={slot("actions")}>{actions}</div>}
    </li>
  );
}

const TYPING_DOT = "sft:size-1.5 sft:rounded-full sft:bg-muted sft:animate-typing sft:motion-reduce:animate-none";

// ChatComposer

export type ChatComposerSlot = "root" | "label" | "input" | "actions" | "send" | "stop" | "retry";

export interface ChatComposerProps extends CopyProps<"chat"> {
  /** Called with the trimmed text on Enter or Send; empty text is never sent. */
  readonly onSend: (text: string) => void;
  /** Stops the answer; shown instead of Send while `submitted` or `streaming`. */
  readonly onStop?: () => void;
  /** Asks again after a failure; shown while `error`. */
  readonly onRetry?: () => void;
  /** `useChat().status`; `ready` by default. */
  readonly status?: ChatStatus;
  /** The text, for a controlled composer (with `onValueChange`); left out, the composer keeps and clears its own. */
  readonly value?: string;
  readonly onValueChange?: (value: string) => void;
  readonly defaultValue?: string;
  readonly disabled?: boolean;
  /** Shows the label above the field; `false` keeps it for screen readers only. */
  readonly showLabel?: boolean;
  readonly rows?: number;
  readonly classNames?: ClassNames<ChatComposerSlot>;
  readonly unstyled?: boolean;
}

const INPUT =
  "sft:m-0 sft:box-border sft:block sft:min-h-10 sft:w-full sft:resize-y sft:rounded-control sft:border sft:border-border-strong sft:bg-surface sft:px-3 sft:py-2 sft:font-sans sft:text-base sft:text-foreground sft:outline-none sft:transition-colors sft:duration-(--sft-duration-fast) sft:hover:border-foreground sft:focus:border-focus sft:focus:ring-1 sft:focus:ring-focus sft:disabled:cursor-not-allowed sft:disabled:opacity-50 sft:sm:text-sm";

/** The chat's input: Enter sends, Shift+Enter adds a line; Send turns into Stop while an answer comes, Retry after a failure. */
export function ChatComposer({
  onSend,
  onStop,
  onRetry,
  status = "ready",
  value,
  onValueChange,
  defaultValue = "",
  disabled = false,
  showLabel = false,
  rows = 2,
  classNames,
  unstyled,
  locale,
  messages,
}: ChatComposerProps) {
  const copy = getCopy("chat", useUiCopyProps("chat", { locale, messages }));
  const inputId = useId();
  const [ownValue, setOwnValue] = useState(defaultValue);
  const isControlled = value !== undefined;
  const text = isControlled ? value : ownValue;
  const isBusy = status === "submitted" || status === "streaming";
  const canStop = isBusy && onStop !== undefined;
  const slot = createSlotClassGetter<ChatComposerSlot>({
    defaults: {
      root: "sft:m-0 sft:flex sft:flex-col sft:gap-2 sft:font-sans",
      label: showLabel ? "sft:text-sm sft:font-medium sft:text-foreground" : "sft:sr-only",
      input: INPUT,
      actions: "sft:flex sft:flex-wrap sft:items-center sft:justify-end sft:gap-2",
      send: "",
      stop: "",
      retry: "",
    },
    classNames,
    unstyled,
  });

  const setText = (next: string) => {
    if (!isControlled) setOwnValue(next);
    onValueChange?.(next);
  };

  const send = () => {
    const trimmed = text.trim();
    if (trimmed === "" || isBusy || disabled) return;
    onSend(trimmed);
    setText("");
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    send();
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    // An IME composition uses Enter to pick a candidate, never to send.
    if (event.key !== "Enter" || event.shiftKey || event.nativeEvent.isComposing) return;
    event.preventDefault();
    send();
  };

  return (
    <form className={slot("root")} data-status={status} onSubmit={handleSubmit}>
      <label htmlFor={inputId} className={slot("label")}>
        {copy.composer.label}
      </label>
      <textarea
        id={inputId}
        name="message"
        rows={rows}
        value={text}
        placeholder={copy.composer.placeholder}
        disabled={disabled}
        onChange={(event) => {
          setText(event.target.value);
        }}
        onKeyDown={handleKeyDown}
        className={slot("input")}
      />
      <div className={slot("actions")}>
        {status === "error" && onRetry !== undefined ? (
          <Button variant="secondary" iconLeft={<RefreshIcon />} onClick={onRetry} disabled={disabled} className={slot("retry")} unstyled={unstyled}>
            {copy.composer.retry}
          </Button>
        ) : null}
        {canStop ? (
          <Button variant="secondary" onClick={onStop} className={slot("stop")} unstyled={unstyled}>
            {copy.composer.stop}
          </Button>
        ) : (
          <Button
            variant="primary"
            type="submit"
            disabled={disabled || isBusy || text.trim() === ""}
            className={slot("send")}
            unstyled={unstyled}
          >
            {copy.composer.send}
          </Button>
        )}
      </div>
    </form>
  );
}

// ToolCallCard

export type ToolCallCardSlot = "root" | "header" | "title" | "status" | "body" | "error";

export interface ToolCallCardProps extends CopyProps<"chat"> {
  /** What the tool does, in the app's words ("Project status"). */
  readonly title: string;
  readonly state: ToolCallState;
  /** The tool's output, drawn by the app's component from validated data; shown when `done`. */
  readonly children?: ReactNode;
  /** Why the call failed, in the user's words; shown when `error`. */
  readonly errorText?: string;
  readonly classNames?: ClassNames<ToolCallCardSlot>;
  readonly unstyled?: boolean;
}

/** A tool call inside an answer: busy while it runs, then its output or its error (`data-state`). */
export function ToolCallCard({ title, state, children, errorText, classNames, unstyled, locale, messages }: ToolCallCardProps) {
  const copy = getCopy("chat", useUiCopyProps("chat", { locale, messages }));
  const slot = createSlotClassGetter<ToolCallCardSlot>({
    defaults: {
      root: "sft:box-border sft:my-2 sft:rounded-card sft:border sft:border-border sft:bg-surface sft:p-3 sft:font-sans sft:whitespace-normal sft:data-[state=error]:border-danger/50",
      header: "sft:flex sft:flex-wrap sft:items-center sft:justify-between sft:gap-2",
      title: "sft:m-0 sft:text-sm sft:font-medium sft:text-foreground",
      status: "sft:text-xs sft:text-muted sft:in-data-[state=error]:text-danger",
      body: "sft:mt-3",
      error: "sft:mt-2 sft:mb-0 sft:text-sm sft:text-foreground",
    },
    classNames,
    unstyled,
  });
  const titleId = useId();
  return (
    <section data-state={state} aria-labelledby={titleId} aria-busy={state === "pending"} className={slot("root")}>
      <div className={slot("header")}>
        <p id={titleId} className={slot("title")}>
          {title}
        </p>
        <span className={slot("status")}>{copy.tool[state]}</span>
      </div>
      {state === "done" && children !== undefined && children !== null ? <div className={slot("body")}>{children}</div> : null}
      {state === "error" && errorText !== undefined && errorText !== "" ? <p className={slot("error")}>{errorText}</p> : null}
    </section>
  );
}

// ReasoningDisclosure

export type ReasoningDisclosureSlot = "root" | "summary" | "content";

export interface ReasoningDisclosureProps extends CopyProps<"chat"> {
  /** The model's reasoning, as text. */
  readonly children?: ReactNode;
  /** True while the reasoning streams: the summary reads `messages.reasoning.streaming`. */
  readonly isStreaming?: boolean;
  readonly defaultOpen?: boolean;
  readonly classNames?: ClassNames<ReasoningDisclosureSlot>;
  readonly unstyled?: boolean;
}

/** The model's reasoning, folded by default under a native `<details>`. */
export function ReasoningDisclosure({
  children,
  isStreaming = false,
  defaultOpen = false,
  classNames,
  unstyled,
  locale,
  messages,
}: ReasoningDisclosureProps) {
  const copy = getCopy("chat", useUiCopyProps("chat", { locale, messages }));
  const slot = createSlotClassGetter<ReasoningDisclosureSlot>({
    defaults: {
      root: "sft:my-2 sft:font-sans sft:whitespace-normal",
      summary:
        "sft:cursor-pointer sft:rounded-control sft:text-sm sft:text-muted sft:hover:text-foreground sft:focus-visible:outline-2 sft:focus-visible:outline-offset-2 sft:focus-visible:outline-focus",
      content: "sft:mt-2 sft:border-l-2 sft:border-border sft:pl-3 sft:text-sm sft:text-muted sft:whitespace-pre-wrap",
    },
    classNames,
    unstyled,
  });
  return (
    <details open={defaultOpen || undefined} data-streaming={isStreaming ? "" : undefined} className={slot("root")}>
      <summary className={slot("summary")}>{isStreaming ? copy.reasoning.streaming : copy.reasoning.title}</summary>
      <div className={slot("content")}>{children}</div>
    </details>
  );
}

// ChatEmptyState

export type ChatEmptyStateSlot = "root" | "title" | "description" | "suggestions" | "suggestion";

export interface ChatEmptyStateProps extends CopyProps<"chat"> {
  /** `messages.empty.title` by default. */
  readonly title?: string;
  readonly description?: ReactNode;
  /** Prompts the user can start with; each is a button. */
  readonly suggestions?: readonly string[];
  readonly onSuggestion?: (suggestion: string) => void;
  readonly classNames?: ClassNames<ChatEmptyStateSlot>;
  readonly unstyled?: boolean;
}

/** Shown instead of the log before the first message, with optional prompt suggestions. */
export function ChatEmptyState({ title, description, suggestions = [], onSuggestion, classNames, unstyled, locale, messages }: ChatEmptyStateProps) {
  const copy = getCopy("chat", useUiCopyProps("chat", { locale, messages }));
  const slot = createSlotClassGetter<ChatEmptyStateSlot>({
    defaults: {
      root: "sft:rounded-control sft:border sft:border-dashed sft:border-border sft:p-4 sft:font-sans",
      title: "sft:m-0 sft:font-medium sft:text-foreground",
      description: "sft:mt-1 sft:mb-0 sft:text-sm sft:text-muted",
      suggestions: "sft:m-0 sft:mt-3 sft:flex sft:list-none sft:flex-wrap sft:gap-2 sft:p-0",
      suggestion: "",
    },
    classNames,
    unstyled,
  });
  return (
    <div className={slot("root")}>
      <p className={slot("title")}>{title ?? copy.empty.title}</p>
      {description === undefined || description === null ? null : <p className={slot("description")}>{description}</p>}
      {suggestions.length === 0 ? null : (
        <ul aria-label={copy.empty.suggestions} className={slot("suggestions")}>
          {suggestions.map((suggestion) => (
            <li key={suggestion}>
              <Button
                variant="secondary"
                size="sm"
                wrap
                onClick={() => onSuggestion?.(suggestion)}
                className={slot("suggestion")}
                unstyled={unstyled}
              >
                {suggestion}
              </Button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ChatError

export type ChatErrorSlot = "root" | "message" | "retry";

export interface ChatErrorProps extends CopyProps<"chat"> {
  /** What went wrong, in the user's words; `messages.error.message` by default. */
  readonly message?: string;
  /** Asks again; the Retry button shows only with it. */
  readonly onRetry?: () => void;
  readonly classNames?: ClassNames<ChatErrorSlot>;
  readonly unstyled?: boolean;
}

/** A failed answer, announced by `role="alert"`, with an optional Retry. */
export function ChatError({ message, onRetry, classNames, unstyled, locale, messages }: ChatErrorProps) {
  const copy = getCopy("chat", useUiCopyProps("chat", { locale, messages }));
  const slot = createSlotClassGetter<ChatErrorSlot>({
    defaults: {
      root: "sft:flex sft:flex-wrap sft:items-center sft:gap-3 sft:rounded-control sft:border sft:border-danger/50 sft:bg-danger/10 sft:px-3 sft:py-2 sft:font-sans",
      message: "sft:m-0 sft:text-sm sft:text-foreground",
      retry: "",
    },
    classNames,
    unstyled,
  });
  return (
    <div role="alert" className={slot("root")}>
      <p className={slot("message")}>{message ?? copy.error.message}</p>
      {onRetry === undefined ? null : (
        <Button variant="secondary" size="sm" iconLeft={<RefreshIcon />} onClick={onRetry} className={slot("retry")} unstyled={unstyled}>
          {copy.error.retry}
        </Button>
      )}
    </div>
  );
}

