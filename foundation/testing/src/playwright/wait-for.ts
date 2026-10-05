export interface WaitForOptions {
  /** What the test waits for, named in the timeout error. */
  readonly description: string;
  readonly timeoutMs?: number;
  readonly intervalMs?: number;
}

/**
 * Polls `probe` until it returns a value (anything but `null` or `undefined`) and returns that value.
 * Unlike `expect.poll`, the caller gets the value it waited for. A probe that throws is retried (the
 * app may still be starting); the last error becomes the `cause` of the timeout error.
 */
export async function waitFor<TValue>(
  probe: () => Promise<TValue | null | undefined>,
  options: WaitForOptions,
): Promise<TValue> {
  const { description, timeoutMs = 10_000, intervalMs = 250 } = options;
  const deadline = Date.now() + timeoutMs;
  let lastError: unknown = null;
  for (;;) {
    try {
      const value = await probe();
      if (value !== null && value !== undefined) return value;
    } catch (error) {
      lastError = error;
    }
    if (Date.now() >= deadline) break;
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }
  throw new Error(
    `waitFor: gave up waiting for ${description} after ${String(timeoutMs)} ms`,
    lastError === null ? undefined : { cause: lastError },
  );
}
