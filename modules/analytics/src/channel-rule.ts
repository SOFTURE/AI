// The rule a channel value must pass, shared by the server and the browser: it imports nothing at
// runtime, so browser code can use it without pulling in the configuration.
import type { ChannelNormalization, ChannelOptions } from "./options.js";

export interface ChannelRuleOptions extends Pick<ChannelOptions, "pattern" | "maxLength"> {
  /** `none` when absent. */
  readonly normalize?: ChannelNormalization;
}

/**
 * `value` when it is a channel the options accept, else null. With `normalize: "trim-lowercase"` the
 * value is trimmed and lowercased first; otherwise it is never repaired. Values are never cut.
 */
export function parseChannel(value: string | null | undefined, options: ChannelRuleOptions): string | null {
  if (typeof value !== "string") return null;
  const normalized = options.normalize === "trim-lowercase" ? value.trim().toLowerCase() : value;
  if (normalized.length === 0 || normalized.length > options.maxLength) return null;
  return options.pattern.test(normalized) ? normalized : null;
}

/**
 * The raw value that decides the channel in `params`: the first value of the first of `names` present
 * (the current parameter, then the legacy ones in order), valid or not; undefined when none is present.
 */
export function readChannelParam(params: URLSearchParams, names: readonly string[]): string | undefined {
  const name = names.find((candidate) => params.has(candidate));
  return name === undefined ? undefined : (params.get(name) ?? undefined);
}
