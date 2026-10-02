"use server";

// A server action shipped in the package. `tag` is bound by the page (`echoAction.bind(null, tag)`).
// Bound arguments travel to the browser in plain text and come back as the client sends them, so they
// are not secret and not trusted (docs/02-module-standard.md §8); `tag` is only a marker.
import { createEcho, ECHO_MAX_LENGTH, type EchoState } from "./echo.js";

// Next only registers async exports of a "use server" file as actions; this one has nothing to await.
// eslint-disable-next-line @typescript-eslint/require-await
export async function echoAction(tag: string, _previous: EchoState | null, formData: FormData): Promise<EchoState> {
  const text = formData.get("text");
  return createEcho(typeof text === "string" ? text.slice(0, ECHO_MAX_LENGTH) : "", tag);
}
