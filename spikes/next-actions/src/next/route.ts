// Route handlers shipped in the package: `export { GET, POST } from "@softure-ai/next-actions/next"`.
// A spike fixture mounted only in the example app: it has no authorization and no rate limit, and it
// shows the installed module ids. A real module checks both before anything else (AGENTS.md Security).
import { z } from "zod";
import { createEcho, ECHO_MAX_LENGTH } from "./echo.js";

const echoInput = z.object({ text: z.string().max(ECHO_MAX_LENGTH) });

export function GET(): Response {
  return Response.json(createEcho("", "route"));
}

export async function POST(request: Request): Promise<Response> {
  const body: unknown = await request.json().catch(() => null);
  const input = echoInput.safeParse(body);
  if (!input.success) {
    return Response.json({ error: "next-actions.invalid_input" }, { status: 400 });
  }
  return Response.json(createEcho(input.data.text, "route"));
}
