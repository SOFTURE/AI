// The chat's route, as @softure-ai/llm's README recommends: the session, the rate limit, the body limit and the
// message validation come before the model is called, since a chat route spends money. Driven by e2e/chat.spec.ts.
import { getCurrentUser } from "@softure-ai/auth/next";
import { errorLogLabel, safeError, systemClock } from "@softure-ai/core";
import { readSmallBody } from "@softure-ai/security";
import { consumeRateLimit } from "@softure-ai/security/server";
import { convertToModelMessages, isStepCount, safeValidateUIMessages } from "ai";
import { after } from "next/server";
import { z } from "zod";
import { llm, pickChatModel } from "../../../lib/chat/llm.ts";
import { chatTools, type ChatMessage } from "../../../lib/chat/tools.ts";
import { getDatabase } from "../../../lib/database.ts";
import config from "../../../softure.config.ts";

export const dynamic = "force-dynamic";

const CHAT_BUCKET = "example.chat";
const MAX_BODY_BYTES = 64_000;
const MAX_MESSAGES = 40;
const MAX_STEPS = 3;

const bodySchema = z.object({ messages: z.array(z.unknown()).min(1).max(MAX_MESSAGES) });

function parseJson(raw: string): unknown {
  try {
    return JSON.parse(raw) as unknown;
  } catch {
    return undefined;
  }
}

export async function POST(request: Request): Promise<Response> {
  const user = await getCurrentUser();
  if (user === null) return Response.json({ error: "auth.unauthenticated" }, { status: 401 });

  try {
    const { db } = await getDatabase();
    const limit = await consumeRateLimit({ db, clock: systemClock, config }, { bucket: CHAT_BUCKET, key: user.id });
    if (!limit.ok) {
      return Response.json({ error: limit.error }, { status: 429, headers: { "retry-after": String(limit.retryAfterSeconds) } });
    }
  } catch (error) {
    console.error(`chat rate limit failed: ${errorLogLabel(error)}`);
    return Response.json({ error: safeError(error).error }, { status: 500 });
  }

  const body = await readSmallBody(request, { maxBytes: MAX_BODY_BYTES });
  if (!body.ok) return Response.json({ error: body.error }, { status: body.error === "security.body_too_large" ? 413 : 400 });
  const parsed = bodySchema.safeParse(parseJson(body.value));
  if (!parsed.success) return Response.json({ error: "chat.invalid_input" }, { status: 400 });
  const validated = await safeValidateUIMessages<ChatMessage>({ messages: parsed.data.messages, tools: chatTools });
  if (!validated.success) return Response.json({ error: "chat.invalid_input" }, { status: 400 });
  const messages = validated.data;

  const stream = llm.streamChat({
    model: pickChatModel(messages),
    instructions: "You answer questions about the team's projects. Use getProjectStatus for a project's state.",
    messages: await convertToModelMessages(messages, { tools: chatTools }),
    tools: chatTools,
    stopWhen: isStepCount(MAX_STEPS),
    // The client's Stop aborts the request: the chat ends with llm.aborted.
    abortSignal: request.signal,
    attributes: { userId: user.id },
  });
  after(() =>
    stream.recorded.catch((error: unknown) => {
      console.error(`chat record failed: ${errorLogLabel(error)}`);
    }),
  );
  return stream.toUIMessageStreamResponse<ChatMessage>({ originalMessages: messages, onError: () => "chat.unavailable" });
}
