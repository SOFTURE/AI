// Upload sessions: createUpload with its limits, chunks written in any order and resumed, finalize into a stored file.
import {
  createUpload,
  deleteFilesUserData,
  exportFilesUserData,
  finalizeUpload,
  getPartKey,
  getUpload,
  openFile,
  pruneFiles,
  saveFile,
  writeUploadChunk,
  type FilesContext,
} from "@softure-ai/files/server";
import { afterEach, describe, expect, it } from "vitest";
import { ALICE, BOB, chunked, closeTestFiles, createTestFiles, HOUR_MS, readText, sha256, type TestFiles } from "./support.js";

const CHUNK = 1024;
/** 2.5 chunks: two full chunks and a half one. */
const CONTENT = "a".repeat(CHUNK) + "b".repeat(CHUNK) + "c".repeat(CHUNK / 2);

function chunkOf(text: string, index: number): { range: { start: number; end: number }; body: AsyncGenerator<Uint8Array>; total: number } {
  const start = index * CHUNK;
  const end = Math.min(start + CHUNK, text.length) - 1;
  return { range: { start, end }, body: chunked(text.slice(start, end + 1), 256), total: text.length };
}

describe("upload sessions", () => {
  let test: TestFiles;

  async function setup(files: Parameters<typeof createTestFiles>[0] = {}): Promise<FilesContext> {
    test = await createTestFiles({ ...files, files: { uploads: { chunkBytes: CHUNK }, ...files.files } });
    return test.ctx;
  }

  async function open(ctx: FilesContext, input: Partial<Parameters<typeof createUpload>[1]> = {}): Promise<string> {
    const created = await createUpload(ctx, { ownerId: ALICE, name: "clip.mp4", contentType: "video/mp4", size: CONTENT.length, ...input });
    if (!created.ok) throw new Error(`setup: ${created.error}`);
    return created.value.uploadId;
  }

  afterEach(closeTestFiles);

  it("answers a signed URL on the uploads route with the chunk layout", async () => {
    const ctx = await setup();
    const created = await createUpload(ctx, { ownerId: ALICE, name: "dir/clip.mp4", contentType: "video/mp4", size: CONTENT.length });
    if (!created.ok) throw new Error(created.error);
    expect(created.value.chunkSize).toBe(CHUNK);
    expect(created.value.chunkCount).toBe(3);
    expect(created.value.expiresAt).toEqual(new Date(test.clock.now().getTime() + 24 * HOUR_MS));
    expect(created.value.uploadUrl).toMatch(new RegExp(`^https://app\\.example\\.com/u/${created.value.uploadId}/\\d+\\.[A-Za-z0-9_-]{43}$`));
    expect(await getUpload(ctx, created.value.uploadId)).toMatchObject({
      name: "clip.mp4",
      size: CONTENT.length,
      received: [],
      receivedBytes: 0,
      missingChunks: [0, 1, 2],
      state: "open",
      fileId: null,
    });
  });

  it("takes chunks in any order, reports what arrived, and finalizes into the file", async () => {
    const ctx = await setup();
    const id = await open(ctx, { sha256: sha256(CONTENT) });
    const third = await writeUploadChunk(ctx, id, chunkOf(CONTENT, 2));
    expect(third.ok && third.value.received).toEqual([{ start: 2 * CHUNK, end: CONTENT.length - 1 }]);
    await writeUploadChunk(ctx, id, chunkOf(CONTENT, 0));
    expect(await getUpload(ctx, id)).toMatchObject({ missingChunks: [1], state: "open", receivedBytes: CHUNK + CHUNK / 2 });
    expect(await finalizeUpload(ctx, id)).toEqual({ ok: false, error: "files.upload_incomplete" });

    const second = await writeUploadChunk(ctx, id, chunkOf(CONTENT, 1));
    expect(second.ok && second.value).toMatchObject({ received: [{ start: 0, end: CONTENT.length - 1 }], state: "complete", missingChunks: [] });
    const finalized = await finalizeUpload(ctx, id);
    if (!finalized.ok) throw new Error(finalized.error);
    expect(finalized.value).toMatchObject({ ownerId: ALICE, name: "clip.mp4", contentType: "video/mp4", size: CONTENT.length, sha256: sha256(CONTENT) });
    const opened = await openFile(ctx, finalized.value.id);
    expect(opened.ok && (await readText(opened.value.body))).toBe(CONTENT);
    expect([...test.storage.objects().keys()].filter((key) => key.startsWith("uploads/"))).toEqual([]);
    expect(await getUpload(ctx, id)).toMatchObject({ state: "finalized", fileId: finalized.value.id });

    expect(await finalizeUpload(ctx, id)).toEqual(finalized);
    expect(await writeUploadChunk(ctx, id, chunkOf(CONTENT, 0))).toEqual({ ok: false, error: "files.not_found" });
  });

  it("takes a file of one chunk without a range", async () => {
    const ctx = await setup();
    const id = await open(ctx, { size: 5, contentType: "text/plain" });
    const written = await writeUploadChunk(ctx, id, { range: null, body: chunked("hello") });
    expect(written.ok && written.value.state).toBe("complete");
    const finalized = await finalizeUpload(ctx, id);
    expect(finalized.ok && finalized.value.size).toBe(5);
  });

  it("refuses ranges that are not one chunk, and bodies of the wrong length, keeping nothing", async () => {
    const ctx = await setup();
    const id = await open(ctx);
    const refuse = (range: { start: number; end: number } | null, total?: number) =>
      writeUploadChunk(ctx, id, { range, body: chunked("x".repeat(CHUNK)), ...(total === undefined ? {} : { total }) });
    expect(await refuse(null)).toEqual({ ok: false, error: "files.invalid_range" });
    expect(await refuse({ start: 1, end: CHUNK })).toEqual({ ok: false, error: "files.invalid_range" });
    expect(await refuse({ start: 0, end: CHUNK - 2 })).toEqual({ ok: false, error: "files.invalid_range" });
    expect(await refuse({ start: 3 * CHUNK, end: 4 * CHUNK - 1 })).toEqual({ ok: false, error: "files.invalid_range" });
    expect(await refuse({ start: 0, end: CHUNK - 1 }, CONTENT.length + 1)).toEqual({ ok: false, error: "files.invalid_range" });

    const short = await writeUploadChunk(ctx, id, { range: { start: 0, end: CHUNK - 1 }, body: chunked("x".repeat(CHUNK - 1)) });
    expect(short).toEqual({ ok: false, error: "files.chunk_length_mismatch" });
    const long = await writeUploadChunk(ctx, id, { range: { start: 0, end: CHUNK - 1 }, body: chunked("x".repeat(CHUNK + 1)) });
    expect(long).toEqual({ ok: false, error: "files.chunk_length_mismatch" });
    expect(test.storage.objects().size).toBe(0);
    expect(await getUpload(ctx, id)).toMatchObject({ missingChunks: [0, 1, 2] });
  });

  it("never rewrites a chunk that arrived", async () => {
    const ctx = await setup();
    const id = await open(ctx);
    await writeUploadChunk(ctx, id, chunkOf(CONTENT, 0));
    const again = await writeUploadChunk(ctx, id, { range: { start: 0, end: CHUNK - 1 }, body: chunked("z".repeat(CHUNK)) });
    expect(again.ok && again.value.missingChunks).toEqual([1, 2]);
    expect(Buffer.from(test.storage.objects().get(getPartKey(id, 0)) ?? []).toString()).toBe("a".repeat(CHUNK));
  });

  it("refuses a file whose bytes do not match the declared SHA-256, and keeps no file", async () => {
    const ctx = await setup();
    const id = await open(ctx, { sha256: sha256("something else") });
    for (const index of [0, 1, 2]) await writeUploadChunk(ctx, id, chunkOf(CONTENT, index));
    expect(await finalizeUpload(ctx, id)).toEqual({ ok: false, error: "files.checksum_mismatch" });
    expect([...test.storage.objects().keys()].filter((key) => !key.startsWith("uploads/"))).toEqual([]);
    expect((await test.database.client.query("SELECT 1 FROM files.files")).rows).toEqual([]);
  });

  it("asks for a part again when storage lost it", async () => {
    const ctx = await setup();
    const id = await open(ctx);
    for (const index of [0, 1, 2]) await writeUploadChunk(ctx, id, chunkOf(CONTENT, index));
    await test.storage.delete(getPartKey(id, 1));
    expect(await finalizeUpload(ctx, id)).toEqual({ ok: false, error: "files.upload_incomplete" });
    expect(await getUpload(ctx, id)).toMatchObject({ missingChunks: [1], state: "open" });
  });

  it("applies the limits up front: size, media types, open sessions, quota, input", async () => {
    const ctx = await setup({ files: { uploads: { chunkBytes: CHUNK, maxOpenPerOwner: 2, contentTypes: ["video/*", "image/png"] }, maxFileBytes: 10_000, quotaBytesPerOwner: 8000 } });
    const create = (input: Partial<Parameters<typeof createUpload>[1]>) => createUpload(ctx, { ownerId: ALICE, name: "a.mp4", contentType: "video/mp4", size: 100, ...input });
    expect(await create({ size: 10_001 })).toEqual({ ok: false, error: "files.too_large" });
    expect(await create({ size: 0 })).toEqual({ ok: false, error: "files.invalid_input" });
    expect(await create({ sha256: "nope" })).toEqual({ ok: false, error: "files.invalid_input" });
    expect(await create({ ttlSeconds: 25 * 3600 })).toEqual({ ok: false, error: "files.invalid_input" });
    expect(await create({ contentType: "text/html" })).toEqual({ ok: false, error: "files.content_type_not_allowed" });
    expect((await create({ contentType: "image/png" })).ok).toBe(true);
    await saveFile(ctx, { ownerId: ALICE, name: "big", body: chunked("x".repeat(7950)) });
    expect(await create({ size: 100 })).toEqual({ ok: false, error: "files.quota_exceeded" });
    expect((await create({ size: 50 })).ok).toBe(true);
    expect(await create({ size: 10 })).toEqual({ ok: false, error: "files.too_many_uploads" });
    expect((await createUpload(ctx, { ownerId: BOB, name: "b.mp4", contentType: "video/mp4", size: 10 })).ok).toBe(true);
    test.clock.advance(25 * HOUR_MS);
    expect((await create({ size: 10 })).ok).toBe(true);
  });

  it("needs the link keyring", async () => {
    const ctx = await setup();
    expect(await createUpload({ ...ctx, env: {} }, { ownerId: ALICE, name: "a", size: 1 })).toEqual({ ok: false, error: "files.link_key_missing" });
  });

  it("hides another owner's session and an expired one", async () => {
    const ctx = await setup();
    const id = await open(ctx);
    expect(await getUpload(ctx, id, { ownerId: BOB })).toBeNull();
    expect(await finalizeUpload(ctx, id, { ownerId: BOB })).toEqual({ ok: false, error: "files.not_found" });
    test.clock.advance(24 * HOUR_MS);
    expect(await getUpload(ctx, id)).toBeNull();
    expect(await writeUploadChunk(ctx, id, chunkOf(CONTENT, 0))).toEqual({ ok: false, error: "files.not_found" });
  });

  it("keeps one file when two finalizes race", async () => {
    const ctx = await setup();
    const id = await open(ctx);
    for (const index of [0, 1, 2]) await writeUploadChunk(ctx, id, chunkOf(CONTENT, index));
    const [first, second] = await Promise.all([finalizeUpload(ctx, id), finalizeUpload(ctx, id)]);
    expect(first.ok && second.ok && first.value.id === second.value.id).toBe(true);
    expect((await test.database.client.query("SELECT 1 FROM files.files")).rows).toHaveLength(1);
  });
});

describe("upload sessions in prune and privacy", () => {
  afterEach(closeTestFiles);

  async function openWithPart(test: TestFiles, ownerId: string): Promise<string> {
    const created = await createUpload(test.ctx, { ownerId, name: "clip.mp4", size: CONTENT.length });
    if (!created.ok) throw new Error(`setup: ${created.error}`);
    await writeUploadChunk(test.ctx, created.value.uploadId, chunkOf(CONTENT, 0));
    return created.value.uploadId;
  }

  it("prunes expired sessions with their parts and keeps live ones", async () => {
    const test = await createTestFiles({ files: { uploads: { chunkBytes: CHUNK } } });
    const old = await openWithPart(test, ALICE);
    test.clock.advance(23 * HOUR_MS);
    const live = await openWithPart(test, ALICE);
    test.clock.advance(HOUR_MS);
    expect(await pruneFiles(test.ctx)).toEqual({ deletedFiles: 0, freedBytes: 0, removedFileIds: [], failedFiles: 0, deletedUploads: 1, failedUploads: 0 });
    expect([...test.storage.objects().keys()]).toEqual([getPartKey(live, 0)]);
    expect((await test.database.client.query<{ id: string }>("SELECT id FROM files.uploads")).rows.map((row) => row.id)).toEqual([live]);
    expect(old).not.toBe(live);
  });

  it("exports open sessions and deletes all of the owner's sessions with their parts", async () => {
    const test = await createTestFiles({ files: { uploads: { chunkBytes: CHUNK } } });
    const alice = await openWithPart(test, ALICE);
    await openWithPart(test, BOB);
    const exported = await exportFilesUserData(test.ctx, ALICE);
    expect(exported.value.uploads.map((upload) => [upload.uploadId, upload.name, upload.receivedBytes])).toEqual([[alice, "clip.mp4", CHUNK]]);
    expect(await deleteFilesUserData(test.ctx, ALICE)).toEqual({ ok: true, value: { deletedFiles: 0, pendingFiles: 0, deletedUploads: 1, pendingUploads: 0 } });
    expect(test.storage.objects().size).toBe(1);
    expect((await exportFilesUserData(test.ctx, ALICE)).value.uploads).toEqual([]);
  });
});
