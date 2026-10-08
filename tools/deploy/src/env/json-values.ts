// Values for `env render` from JSON objects, the way a GitHub Actions job hands them over (`toJSON(secrets)`,
// `toJSON(vars)`), so the job keeps no second list of names. Problems name the variable, never a value.

/** One JSON object of names and values, held by the environment variable `variable`. */
export interface JsonValuesSource {
  readonly variable: string;
  readonly text: string | undefined;
}

export type JsonValuesResult =
  /** `overridden`: names a later source took over an earlier one's value, sorted. */
  | { ok: true; values: Record<string, string>; overridden: string[] }
  | { ok: false; problem: string };

/** The string values of each source, a later source over an earlier one; other value types are skipped. */
export function mergeJsonValues(sources: readonly JsonValuesSource[]): JsonValuesResult {
  const values: Record<string, string> = {};
  const overridden = new Set<string>();
  for (const { variable, text } of sources) {
    if (text === undefined || text === "") return { ok: false, problem: `${variable} is not set; it must hold a JSON object of names and values` };
    let parsed: unknown;
    try {
      parsed = JSON.parse(text);
    } catch {
      parsed = null;
    }
    if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
      return { ok: false, problem: `${variable} is not a JSON object of names and values` };
    }
    for (const [name, value] of Object.entries(parsed)) {
      if (typeof value !== "string") continue;
      if (Object.hasOwn(values, name)) overridden.add(name);
      values[name] = value;
    }
  }
  return { ok: true, values, overridden: [...overridden].sort() };
}
