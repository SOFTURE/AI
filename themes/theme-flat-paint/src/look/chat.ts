// The Flat Paint look of `@softure-ai/ui`'s chat primitives. The `--sft-*` bridge already paints them in the theme's
// roles; these maps add only what differs: the type scale's steps, an outline that separates the user's bubble from
// the answer (both surfaces are white in the light scheme), and a second carrier for every state (border style and a
// leading edge, not colour alone). Lime stays paint: only the primary Send button fills with it, as ui draws it.

/** The slots of `@softure-ai/ui`'s `ChatLog`. */
export type ChatLogSlot = "root" | "log" | "list" | "announcer";
/** The slots of `@softure-ai/ui`'s `ChatMessage`. */
export type ChatMessageSlot = "root" | "label" | "bubble" | "typing" | "meta" | "actions";
/** The slots of `@softure-ai/ui`'s `ChatComposer`. */
export type ChatComposerSlot = "root" | "label" | "input" | "actions" | "send" | "stop" | "retry";
/** The slots of `@softure-ai/ui`'s `ToolCallCard`. */
export type ToolCallCardSlot = "root" | "header" | "title" | "status" | "body" | "error";
/** The slots of `@softure-ai/ui`'s `ReasoningDisclosure`. */
export type ReasoningDisclosureSlot = "root" | "summary" | "content";
/** The slots of `@softure-ai/ui`'s `ChatEmptyState`. */
export type ChatEmptyStateSlot = "root" | "title" | "description" | "suggestions" | "suggestion";
/** The slots of `@softure-ai/ui`'s `ChatError`. */
export type ChatErrorSlot = "root" | "message" | "retry";

/** The message list: messages one card step apart. */
export const CHAT_LOG_LOOK: Readonly<Partial<Record<ChatLogSlot, string>>> = {
  list: "gap-6",
};

/**
 * A message, by ui's `data-role` and `data-status`: the role's name on `caption` in bold, the user's bubble outlined
 * in `line-strong` (ui fills it `surface-raised`), a failed message with a 4 px `debt` leading edge besides its
 * colour, and the meta line (cost, time) as even digits on `caption`.
 */
export const CHAT_MESSAGE_LOOK: Readonly<Partial<Record<ChatMessageSlot, string>>> = {
  label: "text-caption font-bold text-muted",
  bubble:
    "rounded-card in-data-[role=user]:border-line-strong in-data-[status=error]:border-debt in-data-[status=error]:border-l-4",
  meta: "num text-caption text-muted",
};

/** The composer: Send, the screen's one lime fill, without ui's transparent border (as the prompt action). */
export const CHAT_COMPOSER_LOOK: Readonly<Partial<Record<ChatComposerSlot, string>>> = {
  send: "border-0",
};

/**
 * A tool call, by ui's `data-state`: a dashed border while it runs, a solid one once it settled, and a 4 px `debt`
 * leading edge when it failed. The state's word sits in a flag with its own outline: dashed `line-strong` and `muted`
 * while running, `accessible` when done, `debt` when failed.
 */
export const TOOL_CALL_CARD_LOOK: Readonly<Partial<Record<ToolCallCardSlot, string>>> = {
  root: "data-[state=pending]:border-dashed data-[state=pending]:border-line-strong data-[state=error]:border-debt data-[state=error]:border-l-4",
  title: "font-bold",
  status:
    "rounded-flag border px-2 py-0.5 text-caption font-bold in-data-[state=pending]:border-dashed in-data-[state=pending]:border-line-strong in-data-[state=pending]:text-muted in-data-[state=done]:border-accessible in-data-[state=done]:text-accessible in-data-[state=error]:border-debt in-data-[state=error]:text-debt",
};

/** The reasoning: the summary on `body-sm` in medium weight, the text under a `line-strong` rule on `body-sm`. */
export const REASONING_DISCLOSURE_LOOK: Readonly<Partial<Record<ReasoningDisclosureSlot, string>>> = {
  summary: "text-body-sm font-medium",
  content: "border-line-strong text-body-sm",
};

/** The empty chat: a card (solid hairline, the card radius and padding) with its title on `subsection`. */
export const CHAT_EMPTY_STATE_LOOK: Readonly<Partial<Record<ChatEmptyStateSlot, string>>> = {
  root: "rounded-card border-solid bg-surface p-card",
  title: "text-subsection font-bold",
  description: "text-body-sm",
};

/** A failed answer: the card radius, a `debt` outline and a 4 px `debt` leading edge on the surface, without ui's tint. */
export const CHAT_ERROR_LOOK: Readonly<Partial<Record<ChatErrorSlot, string>>> = {
  root: "rounded-card border-debt border-l-4 bg-surface",
};

/** Every chat map by component, for `classNames={CHAT_LOOK.message}` and the like. */
export const CHAT_LOOK = {
  log: CHAT_LOG_LOOK,
  message: CHAT_MESSAGE_LOOK,
  composer: CHAT_COMPOSER_LOOK,
  toolCall: TOOL_CALL_CARD_LOOK,
  reasoning: REASONING_DISCLOSURE_LOOK,
  emptyState: CHAT_EMPTY_STATE_LOOK,
  error: CHAT_ERROR_LOOK,
} as const;
