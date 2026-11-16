// The chat's llm client. A real app builds it once with its provider's model (see @softure-ai/llm's README); the
// example is the e2e harness and calls no provider, so each request gets a scripted streaming model
// (`fakeChatModel` of @softure-ai/llm/testing) picked from the last user message:
// - a question about a project streams a sentence, calls getProjectStatus, then answers (the tool card);
// - "take your time" streams a few words and never finishes until the client presses Stop (llm.aborted);
// - "fail once" fails the first attempt of that message and answers its retry (regenerate resends the same id);
// - anything else streams a slow answer, so the streaming state is visible.
import { createLlm, type LlmModel, type ModelPricing } from "@softure-ai/llm";
import { fakeChatModel, type FakeChatResponse } from "@softure-ai/llm/testing";
import type { ChatMessage } from "./tools.ts";

export const CHAT_MODEL_ID = "example/scripted-chat";

const CHUNK_DELAY_MS = 60;
const PRICING: ModelPricing = { [CHAT_MODEL_ID]: { inputPerMillion: 3, outputPerMillion: 15 } };

const PROJECT_ANSWER =
  "Apollo is at risk: it is 64% done with 7 tasks still open. The launch date holds only if the open tasks close this week.";
const DEFAULT_ANSWER =
  "I can tell you how a project is doing. Ask me about the Apollo project, and I will look up its status, progress and open tasks.";
const RETRY_ANSWER = "The second attempt worked: the assistant is back and answering.";

/** User message ids whose first attempt already failed, so their retry answers. One process, kept for its lifetime. */
const failedMessageIds = new Set<string>();

export const llm = createLlm({
  model: scriptedModel([{ kind: "text", text: DEFAULT_ANSWER }]),
  pricing: PRICING,
  timeoutMs: 60_000,
  onCall: (record) => {
    console.info(`chat ${record.operation}: ${record.outcome}, ${String(record.usage?.totalTokens ?? 0)} tokens, cost ${String(record.costUsd)} USD`);
  },
});

/** The scripted model for this request's last user message. */
export function pickChatModel(messages: readonly ChatMessage[]): LlmModel {
  const last = messages.findLast((message) => message.role === "user");
  if (last === undefined) return scriptedModel([{ kind: "text", text: DEFAULT_ANSWER }]);
  const text = last.parts
    .flatMap((part) => (part.type === "text" ? [part.text] : []))
    .join(" ")
    .toLowerCase();
  if (text.includes("take your time")) return scriptedModel([{ kind: "hang", text: "Let me think this over carefully " }]);
  if (text.includes("fail once")) {
    if (failedMessageIds.has(last.id)) return scriptedModel([{ kind: "text", text: RETRY_ANSWER }]);
    failedMessageIds.add(last.id);
    return scriptedModel([{ kind: "unavailable" }]);
  }
  if (text.includes("project") || text.includes("apollo")) {
    return scriptedModel([
      { kind: "tool-call", toolName: "getProjectStatus", input: { projectId: "apollo" }, text: "Let me look the project up. " },
      { kind: "text", text: PROJECT_ANSWER },
    ]);
  }
  return scriptedModel([{ kind: "text", text: DEFAULT_ANSWER }]);
}

function scriptedModel(responses: [FakeChatResponse, ...FakeChatResponse[]]): LlmModel {
  return fakeChatModel({ modelId: CHAT_MODEL_ID, chunkDelayInMs: CHUNK_DELAY_MS }, ...responses);
}
