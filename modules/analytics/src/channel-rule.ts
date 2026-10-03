// The rule a channel value must pass, shared by the server and the browser: it imports nothing at
// runtime, so browser code can use it without pulling in the configuration.
import type { ChannelOptions } from "./options.js";

/** `value` when it is a channel the options accept, else null. Values are never trimmed or cut. */
export function parseChannel(value: string | null | undefined, options: Pick<ChannelOptions, "pattern" | "maxLength">): string | null {
  if (typeof value !== "string" || value.length === 0 || value.length > options.maxLength) return null;
  return options.pattern.test(value) ? value : null;
}
