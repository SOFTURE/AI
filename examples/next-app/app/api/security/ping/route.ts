// A public endpoint guarded the way AGENTS.md asks for: the client is identified, its attempt is
// counted before any work, and the body is read with a cap. Driven by e2e/security.spec.ts.
import { errorLogLabel, safeError, systemClock } from "@softure-ai/core";
import { readSmallBody } from "@softure-ai/security";
import { consumeRateLimit, identifyClient } from "@softure-ai/security/server";
import { getDatabase } from "../../../../lib/database.ts";
import config from "../../../../softure.config.ts";

const PING_BUCKET = "example.ping";
const MAX_BODY_BYTES = 64;

export async function POST(request: Request): Promise<Response> {
  const client = identifyClient({ config }, request.headers);
  if (!client.ok) {
    return Response.json({ error: client.error }, { status: 400 });
  }

  try {
    const { db } = await getDatabase();
    const limit = await consumeRateLimit({ db, clock: systemClock, config }, { bucket: PING_BUCKET, key: client.value });
    if (!limit.ok) {
      return Response.json(
        { error: limit.error },
        { status: 429, headers: { "retry-after": String(limit.retryAfterSeconds) } },
      );
    }

    const body = await readSmallBody(request, { maxBytes: MAX_BODY_BYTES });
    if (!body.ok) {
      return Response.json({ error: body.error }, { status: body.error === "security.body_too_large" ? 413 : 400 });
    }
    return Response.json({ remaining: limit.value.remaining, body: body.value });
  } catch (error) {
    console.error(`security ping failed: ${errorLogLabel(error)}`);
    return Response.json({ error: safeError(error).error }, { status: 500 });
  }
}
