// A read for a prerendered page (issue #318): `next build` has no database, and a page that throws on a
// failed read fails the build or the revalidation. The page renders without the rows instead, and
// the failure is logged.

/** The phase Next sets in `process.env.NEXT_PHASE` while it builds. */
export const NEXT_BUILD_PHASE = "phase-production-build";

export interface StaticReadOptions {
  /** Where a failed read is reported; `console.error` by default. */
  readonly onError?: (message: string) => void;
  /** Next's phase; `process.env.NEXT_PHASE` by default (tests pass it). */
  readonly phase?: string | undefined;
}

/** The rows `read` answers; none during `next build`, and none (logged) when the read fails. */
export async function readForStaticPage<T>(read: () => Promise<readonly T[]>, options: StaticReadOptions = {}): Promise<T[]> {
  const phase = "phase" in options ? options.phase : process.env.NEXT_PHASE;
  if (phase === NEXT_BUILD_PHASE) return [];
  try {
    return [...(await read())];
  } catch (error) {
    const onError = options.onError ?? ((message: string) => console.error(message));
    onError(`@softure-ai/blog: reading published articles for a static page failed: ${error instanceof Error ? error.message : String(error)}`);
    return [];
  }
}
