// Serving a stored file to its signed-in owner: the answer of a public link (ranges, the same headers), found by id
// and owner instead of a signature, and the one 404 for anything missing or another owner's.
import type { StoredFile } from "@softure-ai/files";
import { deleteFile, saveFile, serveStoredFile } from "@softure-ai/files/server";
import { afterEach, describe, expect, it } from "vitest";
import { ALICE, BOB, chunked, closeTestFiles, createTestFiles, HOUR_MS, type TestFiles } from "./support.js";

const DIGITS = "0123456789";
const FILE_URL = "https://app.example.com/media/file";

interface Answer {
  readonly status: number;
  readonly headers: Record<string, string>;
  readonly body: string;
}

describe("serving a stored file to its owner", () => {
  let test: TestFiles;

  async function save(options: { ttlSeconds?: number; name?: string } = {}): Promise<StoredFile> {
    const saved = await saveFile(test.ctx, {
      ownerId: ALICE,
      body: chunked(DIGITS),
      name: options.name ?? "digits.txt",
      contentType: "text/plain",
      ttlSeconds: options.ttlSeconds,
    });
    if (!saved.ok) throw new Error(`setup: ${saved.error}`);
    return saved.value;
  }

  async function serve(fileId: string, init: RequestInit & { ownerId?: string; disposition?: "attachment" | "inline" } = {}): Promise<Answer> {
    const { ownerId = ALICE, disposition, ...requestInit } = init;
    const response = await serveStoredFile(test.ctx, fileId, new Request(FILE_URL, requestInit), { ownerId, disposition });
    return {
      status: response.status,
      headers: Object.fromEntries(response.headers),
      body: await response.text(),
    };
  }

  async function expectNotFound(fileId: string, ownerId = ALICE): Promise<void> {
    expect(await serve(fileId, { ownerId })).toEqual({
      status: 404,
      headers: {
        "cache-control": "private, no-store",
        "content-length": "10",
        "content-type": "text/plain; charset=utf-8",
        "referrer-policy": "no-referrer",
        "x-content-type-options": "nosniff",
      },
      body: "Not found\n",
    });
  }

  afterEach(closeTestFiles);

  it("serves the whole file inline under its stored name, with the headers of a link", async () => {
    test = await createTestFiles();
    const file = await save({ name: "Résumé.txt" });

    expect(await serve(file.id)).toEqual({
      status: 200,
      headers: {
        "accept-ranges": "bytes",
        "cache-control": "private, no-store",
        "content-disposition": `inline; filename="R_sum_.txt"; filename*=UTF-8''R%C3%A9sum%C3%A9.txt`,
        "content-length": "10",
        "content-security-policy": "sandbox; default-src 'none'",
        "content-type": "text/plain",
        "referrer-policy": "no-referrer",
        "x-content-type-options": "nosniff",
      },
      body: DIGITS,
    });
  });

  it("serves a byte range with 206 and its Content-Range", async () => {
    test = await createTestFiles();
    const file = await save();

    const answer = await serve(file.id, { headers: { range: "bytes=2-5" } });
    expect([answer.status, answer.headers["content-range"], answer.headers["content-length"], answer.body]).toEqual([
      206,
      "bytes 2-5/10",
      "4",
      "2345",
    ]);
    const suffix = await serve(file.id, { headers: { range: "bytes=-3" } });
    expect([suffix.status, suffix.headers["content-range"], suffix.body]).toEqual([206, "bytes 7-9/10", "789"]);
  });

  it("answers 416 for a range past the end", async () => {
    test = await createTestFiles();
    const file = await save();

    const answer = await serve(file.id, { headers: { range: "bytes=10-" } });
    expect([answer.status, answer.headers["content-range"], answer.body]).toEqual([416, "bytes */10", ""]);
  });

  it("answers HEAD with the GET headers and no body", async () => {
    test = await createTestFiles();
    const file = await save();

    const head = await serve(file.id, { method: "HEAD", headers: { range: "bytes=0-3" } });
    expect([head.status, head.headers["content-length"], head.headers["content-range"], head.body]).toEqual([206, "4", "bytes 0-3/10", ""]);
  });

  it("serves as an attachment when asked", async () => {
    test = await createTestFiles();
    const file = await save();

    const answer = await serve(file.id, { disposition: "attachment" });
    expect(answer.headers["content-disposition"]).toBe(`attachment; filename="digits.txt"; filename*=UTF-8''digits.txt`);
  });

  it("answers the one 404 for another owner's, an unknown, a malformed, a deleted and an expired file", async () => {
    test = await createTestFiles();
    const file = await save();
    await expectNotFound(file.id, BOB);
    await expectNotFound("00000000-0000-4000-8000-000000000000");
    await expectNotFound("not-a-uuid");

    const expiring = await save({ ttlSeconds: 3600 });
    test.clock.advance(HOUR_MS + 1);
    await expectNotFound(expiring.id);

    expect((await deleteFile(test.ctx, file.id)).ok).toBe(true);
    await expectNotFound(file.id);
  });

  it("answers the 404 for a file whose bytes are gone from storage", async () => {
    test = await createTestFiles();
    const file = await save();
    for (const key of test.storage.objects().keys()) await test.storage.delete(key);

    await expectNotFound(file.id);
  });

  it("refuses methods other than GET and HEAD", async () => {
    test = await createTestFiles();
    const file = await save();

    const answer = await serve(file.id, { method: "POST" });
    expect([answer.status, answer.headers.allow]).toEqual([405, "GET, HEAD"]);
  });
});
