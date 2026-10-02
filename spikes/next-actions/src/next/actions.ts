"use server";

// A server action shipped in the package. `tag` is bound by the page (`echoAction.bind(null, tag)`),
// so Next encrypts it into the form: the multi-instance check for NEXT_SERVER_ACTIONS_ENCRYPTION_KEY.
import { createEcho, type EchoState } from "./echo.js";

const ECHO_MAX_LENGTH = 200;

// Next only registers async exports of a "use server" file as actions; this one has nothing to await.
// eslint-disable-next-line @typescript-eslint/require-await
export async function echoAction(tag: string, _previous: EchoState | null, formData: FormData): Promise<EchoState> {
  const text = formData.get("text");
  return createEcho(typeof text === "string" ? text.slice(0, ECHO_MAX_LENGTH) : "", tag);
}
