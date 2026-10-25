/** One intended difference between a pinned shadcn new-york v4 file and the package's copy. */
export interface UiDelta {
  /** Why the package differs: the design system's rule or the package's need. */
  readonly reason: string;
  /** The upstream text replaced; it must occur exactly once in the upstream file. */
  readonly upstream: string;
  /** The package's text in its place. */
  readonly ours: string;
}

export type ApplyResult = { readonly ok: true; readonly text: string } | { readonly ok: false; readonly error: string };

function countOccurrences(text: string, part: string): number {
  return text.split(part).length - 1;
}

/** Applies the deltas in order to the upstream text; fails on the first delta whose upstream text is not there exactly once. */
export function applyDeltas(upstream: string, deltas: readonly UiDelta[]): ApplyResult {
  let text = upstream;
  for (const [index, delta] of deltas.entries()) {
    const count = countOccurrences(text, delta.upstream);
    if (count !== 1) {
      return { ok: false, error: `delta ${index} (${delta.reason}) matches ${count} times, expected once: ${JSON.stringify(delta.upstream.slice(0, 80))}` };
    }
    text = text.replace(delta.upstream, () => delta.ours);
  }
  return { ok: true, text };
}

/** The first line where two texts differ, both sides, for a readable failure. */
export function findFirstDifference(expected: string, actual: string): string | null {
  const expectedLines = expected.split("\n");
  const actualLines = actual.split("\n");
  for (let line = 0; line < Math.max(expectedLines.length, actualLines.length); line++) {
    if (expectedLines[line] !== actualLines[line]) {
      return `line ${line + 1}:\n  upstream + deltas: ${expectedLines[line] ?? "(end of file)"}\n  package:           ${actualLines[line] ?? "(end of file)"}`;
    }
  }
  return null;
}
