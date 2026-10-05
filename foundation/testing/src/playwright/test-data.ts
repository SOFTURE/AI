import { randomUUID } from "node:crypto";

/**
 * A name no other test, worker or run can produce: the database lives across runs and parallel
 * workers, so test data never collides and cleanup can find exactly its own rows.
 */
export function uniqueName(prefix: string): string {
  return `${prefix}-${randomUUID()}`;
}

/** A unique address on a reserved domain (`example.com` by default), so no real mailbox gets mail. */
export function uniqueEmail(prefix: string, domain = "example.com"): string {
  return `${uniqueName(prefix)}@${domain}`;
}

/** Anything that can be closed: a `@softure-ai/db` `DatabaseHandle` fits. */
export interface Closable {
  close(): Promise<void>;
}

/**
 * Opens a connection, runs `work` with it and closes it whatever `work` does. For setup and cleanup
 * that reads or writes rows directly, through the same database package the app uses.
 */
export async function withDatabase<THandle extends Closable, TResult>(
  open: () => Promise<THandle>,
  work: (handle: THandle) => Promise<TResult>,
): Promise<TResult> {
  const handle = await open();
  try {
    return await work(handle);
  } finally {
    await handle.close();
  }
}
