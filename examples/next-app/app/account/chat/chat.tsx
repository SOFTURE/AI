"use client";
// The chat on AI SDK UI's useChat, mapped onto @softure-ai/ui's chat primitives as ui's README shows: message parts
// become props, and each tool's validated output is drawn by its entry in TOOL_VIEWS. Output is data, never HTML.
import { useChat } from "@ai-sdk/react";
import {
  ChatComposer,
  ChatEmptyState,
  ChatError,
  ChatLog,
  ChatMessage,
  ProgressBar,
  ReasoningDisclosure,
  Stat,
  ToolCallCard,
  type StatTone,
  type ToolCallState,
} from "@softure-ai/ui";
import { DefaultChatTransport, type ToolUIPart } from "ai";
import type { ReactNode } from "react";
import type { ChatMessage as AppChatMessage, ChatTools, ProjectStatus } from "../../../lib/chat/tools.ts";
import type { AppMessages } from "../../../messages/index.ts";

type ChatCopy = AppMessages["chat"];
type ToolName = keyof ChatTools;
type ToolView<Name extends ToolName> = { readonly title: string; readonly render: (output: ChatTools[Name]["output"]) => ReactNode };

const STATUS_TONE: Readonly<Record<ProjectStatus["status"], StatTone>> = {
  on_track: "success",
  at_risk: "warning",
  blocked: "danger",
};

const transport = new DefaultChatTransport<AppChatMessage>({ api: "/api/chat" });

function getToolState(state: ToolUIPart["state"]): ToolCallState {
  if (state === "output-available") return "done";
  if (state === "output-error" || state === "output-denied") return "error";
  return "pending";
}

function getToolViews(copy: ChatCopy): { readonly [Name in ToolName]: ToolView<Name> } {
  return {
    getProjectStatus: { title: copy.toolTitle, render: (output) => <ProjectStatusFigures status={output} copy={copy} /> },
  };
}

function ProjectStatusFigures({ status, copy }: { readonly status: ProjectStatus; readonly copy: ChatCopy }) {
  return (
    <div className="stack">
      <div className="actions-row">
        <Stat label={copy.status.label} value={copy.status[status.status]} tone={STATUS_TONE[status.status]} />
        <Stat label={copy.progress} value={`${String(status.progressPercent)}%`} />
        <Stat label={copy.openTasks} value={String(status.openTasks)} />
      </div>
      <ProgressBar label={status.name} value={status.progressPercent} />
    </div>
  );
}

function renderPart(part: AppChatMessage["parts"][number], key: number, copy: ChatCopy): ReactNode {
  if (part.type === "text") return part.text;
  if (part.type === "reasoning") {
    return (
      <ReasoningDisclosure key={key} isStreaming={part.state === "streaming"}>
        {part.text}
      </ReasoningDisclosure>
    );
  }
  if (part.type.startsWith("tool-")) {
    const tool = part as ToolUIPart<ChatTools>;
    const name = tool.type.slice("tool-".length) as ToolName;
    const view = getToolViews(copy)[name];
    const state = getToolState(tool.state);
    return (
      <ToolCallCard key={key} title={view.title} state={state} errorText={state === "error" ? copy.toolFailed : undefined}>
        {tool.state === "output-available" ? view.render(tool.output) : null}
      </ToolCallCard>
    );
  }
  return null;
}

function getText(message: AppChatMessage): string {
  return message.parts.flatMap((part) => (part.type === "text" ? [part.text] : [])).join(" ");
}

export function ProjectChat({ copy }: { readonly copy: ChatCopy }) {
  const { messages, sendMessage, status, stop, regenerate, error } = useChat<AppChatMessage>({ transport });
  const isStreaming = status === "submitted" || status === "streaming";
  const last = messages.at(-1);
  const announcement = last?.role === "assistant" ? getText(last) : undefined;
  const send = (text: string) => void sendMessage({ text });
  const retry = () => void regenerate();
  return (
    <div className="stack">
      {messages.length === 0 ? (
        <ChatEmptyState suggestions={[copy.suggestion]} onSuggestion={send} />
      ) : (
        <ChatLog isStreaming={isStreaming} announcement={announcement}>
          {messages.map((message) => (
            <ChatMessage
              key={message.id}
              role={message.role}
              status={isStreaming && message === last && message.role === "assistant" ? "streaming" : "done"}
            >
              {message.parts.map((part, index) => renderPart(part, index, copy))}
            </ChatMessage>
          ))}
          {status === "submitted" ? <ChatMessage role="assistant" status="streaming" /> : null}
        </ChatLog>
      )}
      {error === undefined ? null : <ChatError message={copy.unavailable} onRetry={retry} />}
      <ChatComposer status={status} onSend={send} onStop={() => void stop()} />
    </div>
  );
}
