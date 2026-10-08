/**
 * Placeholders in the text of a screenshot or of the sign-in: `{env:NAME}` reads the environment (a password stays
 * out of marketing.json), `{data:key}` reads what `signIn.prepare` printed (a value of the seeded account, so the
 * phrase gate proves the frame shows that account). Pure: the CLI supplies both sources.
 */

export const PLACEHOLDER_KINDS = ["env", "data"] as const;

export type PlaceholderKind = (typeof PLACEHOLDER_KINDS)[number];

export interface Placeholder {
  kind: PlaceholderKind;
  key: string;
}

/** `{env:NAME}` or `{data:key}`; the key is an identifier, so a brace in ordinary text never matches by accident. */
const PLACEHOLDER_PATTERN = /\{(env|data):([A-Za-z_][A-Za-z0-9_]*)\}/g;
/** Any `{word:…}` that looks like a placeholder, to refuse a misspelt kind instead of leaving it in the text. */
const PLACEHOLDER_LIKE_PATTERN = /\{[A-Za-z]+:[^{}\s]*\}/g;
const WHOLE_PLACEHOLDER_PATTERN = /^\{(?:env|data):[A-Za-z_][A-Za-z0-9_]*\}$/;

export function findPlaceholders(text: string): Placeholder[] {
  return [...text.matchAll(PLACEHOLDER_PATTERN)].map((match) => ({ kind: match[1] as PlaceholderKind, key: match[2] ?? "" }));
}

/** The first `{kind:…}` whose kind or key is not a placeholder this kit knows, or null. */
export function findMalformedPlaceholder(text: string): string | null {
  for (const match of text.matchAll(PLACEHOLDER_LIKE_PATTERN)) {
    if (!WHOLE_PLACEHOLDER_PATTERN.test(match[0])) return match[0];
  }
  return null;
}

export interface PlaceholderSources {
  env: Readonly<Record<string, string | undefined>>;
  /** What `signIn.prepare` printed; null when it did not run. */
  data: Readonly<Record<string, string>> | null;
}

export type ResolveResult = { ok: true; value: string } | { ok: false; error: string };

/**
 * The text with every placeholder replaced; `encode` applies to the inserted values only (a page path). An unset
 * variable or a key the preparation did not print is an error naming the placeholder, never its value.
 */
export function resolvePlaceholders(text: string, sources: PlaceholderSources, encode: (value: string) => string = (value) => value): ResolveResult {
  for (const { kind, key } of findPlaceholders(text)) {
    if (kind === "env" && (sources.env[key] === undefined || sources.env[key] === "")) {
      return { ok: false, error: `{env:${key}} is not set in the environment` };
    }
    if (kind === "data" && sources.data === null) return { ok: false, error: `{data:${key}} needs signIn.prepare, which did not run` };
    if (kind === "data" && !Object.hasOwn(sources.data ?? {}, key)) {
      return { ok: false, error: `{data:${key}} is not in what signIn.prepare printed (keys: ${Object.keys(sources.data ?? {}).join(", ") || "none"})` };
    }
  }
  const value = text.replace(PLACEHOLDER_PATTERN, (_match, kind: PlaceholderKind, key: string) =>
    encode(kind === "env" ? (sources.env[key] ?? "") : (sources.data?.[key] ?? "")),
  );
  return { ok: true, value };
}
