// Route handlers shipped in the package: `export { GET, POST } from "@softure-ai/next-actions/next"`.
import { createEcho } from "./echo.js";

export function GET(): Response {
  return Response.json(createEcho("", "route"));
}

export async function POST(request: Request): Promise<Response> {
  const body: unknown = await request.json().catch(() => null);
  const text = typeof body === "object" && body !== null && "text" in body && typeof body.text === "string" ? body.text : "";
  return Response.json(createEcho(text, "route"));
}
