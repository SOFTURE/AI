// Shared setup: an app configuration with the files module on an in-memory storage, a test link keyring, a test
// clock and a migrated PGlite database.
import { createHash } from "node:crypto";
import { createTestClock, defineSoftureConfig, type AnySoftureModule, type SoftureConfig, type TestClock } from "@softure-ai/core";
import { createTestDatabase, type TestDatabase } from "@softure-ai/db/testing";
import { files } from "@softure-ai/files";
import type { FilesContext } from "@softure-ai/files/server";
import { createMemoryStorage, createTestLinkKeys, type MemoryStorage } from "@softure-ai/files/testing";

export const NOW = new Date("2026-10-29T12:00:00Z");
export const ALICE = "7d1f3c1e-2b3a-4c5d-8e9f-0a1b2c3d4e5f";
export const BOB = "0b9e2f4a-6c1d-4e3b-9a8f-7c6d5e4f3a2b";
export const HOUR_MS = 60 * 60 * 1000;

/** What the app passes to `files(...)`: the options plus route and message overrides. */
export type FilesInput = NonNullable<Parameters<typeof files>[0]>;

export function createConfig(options: FilesInput, extraModules: readonly AnySoftureModule[] = []): SoftureConfig {
  return defineSoftureConfig({
    database: { url: "pglite://" },
    locale: "en",
    timezone: "Europe/Warsaw",
    appOrigin: "https://app.example.com",
    modules: [files(options), ...extraModules],
  });
}

export interface TestFiles {
  readonly ctx: FilesContext;
  readonly clock: TestClock;
  readonly database: TestDatabase;
  readonly config: SoftureConfig;
  readonly storage: MemoryStorage;
}

export interface CreateTestFilesOptions {
  readonly files?: Omit<FilesInput, "storage">;
  readonly keys?: readonly string[];
  readonly extraModules?: readonly AnySoftureModule[];
}

const openDatabases: TestDatabase[] = [];

/** Closes every database `createTestFiles` opened (an `afterEach` for tests that create one per case). */
export async function closeTestFiles(): Promise<void> {
  await Promise.all(openDatabases.splice(0).map((database) => database.close()));
}

export async function createTestFiles(options: CreateTestFilesOptions = {}): Promise<TestFiles> {
  const storage = createMemoryStorage();
  const config = createConfig({ storage, ...options.files }, options.extraModules);
  const database = await createTestDatabase(config.modules);
  openDatabases.push(database);
  const clock = createTestClock(NOW);
  return {
    ctx: {
      db: database.db,
      clock,
      config,
      env: createTestLinkKeys(options.keys),
    },
    clock,
    database,
    config,
    storage,
  };
}

/** A body of `text` in chunks of `chunkSize` characters, as a stream would deliver it. */
export async function* chunked(text: string | Uint8Array, chunkSize = 4): AsyncGenerator<Uint8Array> {
  const bytes = typeof text === "string" ? Buffer.from(text) : text;
  for (let offset = 0; offset < bytes.byteLength; offset += chunkSize) {
    await Promise.resolve();
    yield bytes.subarray(offset, offset + chunkSize);
  }
}

export async function readText(stream: ReadableStream<Uint8Array>): Promise<string> {
  return new Response(stream).text();
}

export function sha256(text: string): string {
  return createHash("sha256").update(text).digest("hex");
}

/** Every row of files.files, as `<name> <kind> <size> deleted?`. */
export async function listRows(database: TestDatabase): Promise<string[]> {
  const result = await database.client.query<{
    original_name: string;
    kind: string;
    size: number;
    deleted_at: Date | null;
  }>("SELECT original_name, kind, size, deleted_at FROM files.files ORDER BY created_at, original_name");
  return result.rows.map((row) => `${row.original_name} ${row.kind} ${String(row.size)}${row.deleted_at === null ? "" : " deleted"}`);
}
