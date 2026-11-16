import {
  ChatComposer,
  type ChatComposerSlot as UiChatComposerSlot,
  ChatEmptyState,
  type ChatEmptyStateSlot as UiChatEmptyStateSlot,
  ChatError,
  type ChatErrorSlot as UiChatErrorSlot,
  ChatLog,
  type ChatLogSlot as UiChatLogSlot,
  ChatMessage,
  type ChatMessageSlot as UiChatMessageSlot,
  type ReasoningDisclosureSlot as UiReasoningDisclosureSlot,
  ToolCallCard,
  type ToolCallCardSlot as UiToolCallCardSlot,
} from "@softure-ai/ui";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import {
  CHAT_COMPOSER_LOOK,
  CHAT_EMPTY_STATE_LOOK,
  CHAT_ERROR_LOOK,
  CHAT_LOG_LOOK,
  CHAT_LOOK,
  CHAT_MESSAGE_LOOK,
  type ChatComposerSlot,
  type ChatEmptyStateSlot,
  type ChatErrorSlot,
  type ChatLogSlot,
  type ChatMessageSlot,
  REASONING_DISCLOSURE_LOOK,
  type ReasoningDisclosureSlot,
  TOOL_CALL_CARD_LOOK,
  type ToolCallCardSlot,
} from "../src/index.js";

// The theme names ui's slots without a runtime import of ui; each pair must stay the same set.
type IsSameSet<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false;
const SLOT_SETS_MATCH: [
  IsSameSet<ChatLogSlot, UiChatLogSlot>,
  IsSameSet<ChatMessageSlot, UiChatMessageSlot>,
  IsSameSet<ChatComposerSlot, UiChatComposerSlot>,
  IsSameSet<ToolCallCardSlot, UiToolCallCardSlot>,
  IsSameSet<ReasoningDisclosureSlot, UiReasoningDisclosureSlot>,
  IsSameSet<ChatEmptyStateSlot, UiChatEmptyStateSlot>,
  IsSameSet<ChatErrorSlot, UiChatErrorSlot>,
] = [true, true, true, true, true, true, true];

/** The class list of the first element whose opening tag matches the pattern. */
function getClasses(markup: string, pattern: RegExp): string[] {
  const tag = pattern.exec(markup)?.[0] ?? "";
  return (/class="([^"]*)"/.exec(tag)?.[1] ?? "").split(" ").filter(Boolean);
}

/** Every class of every slot of a look map. */
function getMapClasses(look: Readonly<Partial<Record<string, string>>>): string[] {
  return Object.values(look).flatMap((classes) => (classes ?? "").split(" "));
}

describe("chat look maps", () => {
  it("name exactly ui's slots", () => {
    expect(SLOT_SETS_MATCH).toEqual([true, true, true, true, true, true, true]);
  });

  it("group every map by component", () => {
    expect(CHAT_LOOK).toEqual({
      log: CHAT_LOG_LOOK,
      message: CHAT_MESSAGE_LOOK,
      composer: CHAT_COMPOSER_LOOK,
      toolCall: TOOL_CALL_CARD_LOOK,
      reasoning: REASONING_DISCLOSURE_LOOK,
      emptyState: CHAT_EMPTY_STATE_LOOK,
      error: CHAT_ERROR_LOOK,
    });
  });

  it("outline the user's bubble in line-strong and give a failed message a debt leading edge", () => {
    const markup = renderToStaticMarkup(
      <ChatLog classNames={CHAT_LOG_LOOK}>
        <ChatMessage role="user" classNames={CHAT_MESSAGE_LOOK} meta="0.004 USD">
          Hello
        </ChatMessage>
      </ChatLog>,
    );
    expect(getClasses(markup, /<ol[^>]*>/)).toContain("gap-6");
    expect(getClasses(markup, /<p[^>]*>You</)).toEqual(expect.arrayContaining(["text-caption", "font-bold", "text-muted"]));
    expect(getClasses(markup, /<div[^>]*class="[^"]*rounded-card[^"]*"[^>]*>Hello/)).toEqual(
      expect.arrayContaining(["sft:in-data-[role=user]:bg-surface-raised", "in-data-[role=user]:border-line-strong", "in-data-[status=error]:border-debt", "in-data-[status=error]:border-l-4"]),
    );
    expect(markup).toContain('class="sft:text-xs sft:text-muted num text-caption text-muted"');
  });

  it("mark a tool call's state by border style and edge besides colour, the word in an outlined flag", () => {
    for (const state of ["pending", "done", "error"] as const) {
      const markup = renderToStaticMarkup(<ToolCallCard title="Project status" state={state} errorText="Timed out" classNames={TOOL_CALL_CARD_LOOK} />);
      const root = getClasses(markup, /<section[^>]*>/);
      expect(root).toEqual(expect.arrayContaining(["data-[state=pending]:border-dashed", "data-[state=error]:border-l-4"]));
      expect(markup).toContain(`data-state="${state}"`);
      expect(getClasses(markup, /<span[^>]*>(Running|Done|Failed)/)).toEqual(expect.arrayContaining(["rounded-flag", "border", "in-data-[state=done]:text-accessible", "in-data-[state=error]:text-debt"]));
    }
  });

  it("keep lime off every map: only ui's primary Send fills with it", () => {
    for (const look of Object.values(CHAT_LOOK)) {
      for (const className of getMapClasses(look)) expect([className, /accent-fill|lime/.test(className)]).toEqual([className, false]);
    }
    const markup = renderToStaticMarkup(<ChatComposer onSend={() => undefined} classNames={CHAT_COMPOSER_LOOK} />);
    expect(markup).toMatch(/<button[^>]*type="submit"[^>]*data-variant="primary"[^>]*class="[^"]*border-0"/);
  });

  it("draw the empty state as a card with a subsection title, and the error with a debt edge", () => {
    const empty = renderToStaticMarkup(<ChatEmptyState suggestions={["Status"]} classNames={CHAT_EMPTY_STATE_LOOK} />);
    expect(getClasses(empty, /<div[^>]*>/)).toEqual(expect.arrayContaining(["rounded-card", "border-solid", "p-card"]));
    expect(getClasses(empty, /<p[^>]*>/)).toEqual(expect.arrayContaining(["text-subsection", "font-bold"]));
    const error = renderToStaticMarkup(<ChatError classNames={CHAT_ERROR_LOOK} />);
    expect(getClasses(error, /<div[^>]*role="alert"[^>]*>/)).toEqual(expect.arrayContaining(["border-debt", "border-l-4", "bg-surface"]));
  });
});
