// saveFile: streamed, hashed and counted while written; size cap, quota, dedupe and expiry; nothing left behind by
// a refused or failed save.
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { findFile, getOwnerUsage, openFile, saveFile } from "@softure-ai/files/server";
import { afterEach, describe, expect, it } from "vitest";
import { ALICE, BOB, chunked, closeTestFiles, createTestFiles, HOUR_MS, listRows, NOW, readText, sha256, type TestFiles } from "./support.js";

describe("saveFile", () => {
  let test: TestFiles;

  afterEach(closeTestFiles);

  it("stores a streamed body with its hash, size, type, name and kind", async () => {
    test = await createTestFiles();

    const saved = await saveFile(test.ctx, {
      ownerId: ALICE,
      body: chunked("hello, files"),
      name: "C:\\Users\\alice\\Report 2026.TXT",
      contentType: "Text/Plain; charset=utf-8",
      kind: "output",
    });

    expect(saved).toEqual({
      ok: true,
      value: {
        id: expect.stringMatching(/^[0-9a-f-]{36}$/) as unknown,
        ownerId: ALICE,
        sha256: sha256("hello, files"),
        size: 12,
        contentType: "text/plain; charset=utf-8",
        name: "Report 2026.TXT",
        kind: "output",
        expiresAt: null,
        createdAt: NOW,
      },
    });
    if (!saved.ok) return;
    expect([...test.storage.objects().keys()]).toEqual([`${saved.value.id.slice(0, 2)}/${saved.value.id.slice(2, 4)}/${saved.value.id}`]);
    const opened = await openFile(test.ctx, saved.value.id);
    expect(opened.ok && (await readText(opened.value.body))).toBe("hello, files");
  });

  it("stores a file from a path, with the defaults for type and kind", async () => {
    test = await createTestFiles();
    const dir = mkdtempSync(join(tmpdir(), "softure-files-save-"));
    try {
      writeFileSync(join(dir, "render.mp4"), "frames");
      const saved = await saveFile(test.ctx, {
        ownerId: ALICE,
        path: join(dir, "render.mp4"),
        name: "render.mp4",
      });
      expect(saved.ok && [saved.value.size, saved.value.contentType, saved.value.kind, saved.value.sha256]).toEqual([
        6,
        "application/octet-stream",
        "file",
        sha256("frames"),
      ]);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("stores an empty file", async () => {
    test = await createTestFiles();
    const saved = await saveFile(test.ctx, {
      ownerId: ALICE,
      body: chunked(""),
      name: "empty",
    });
    expect(saved.ok && [saved.value.size, saved.value.sha256]).toEqual([0, sha256("")]);
  });

  it("refuses a file one byte over maxFileBytes and keeps nothing of it", async () => {
    test = await createTestFiles({ files: { maxFileBytes: 10 } });

    expect(
      await saveFile(test.ctx, {
        ownerId: ALICE,
        body: chunked("0123456789x"),
        name: "big",
      }),
    ).toEqual({ ok: false, error: "files.too_large" });
    expect(test.storage.objects().size).toBe(0);
    expect(await listRows(test.database)).toEqual([]);
    expect(
      (
        await saveFile(test.ctx, {
          ownerId: ALICE,
          body: chunked("0123456789"),
          name: "fits",
        })
      ).ok,
    ).toBe(true);
  });

  it("stops reading the body at the first chunk over the cap", async () => {
    test = await createTestFiles({ files: { maxFileBytes: 8 } });
    let chunksRead = 0;
    async function* endless(): AsyncGenerator<Uint8Array> {
      for (;;) {
        chunksRead += 1;
        await Promise.resolve();
        yield Buffer.from("1234");
      }
    }

    expect(
      await saveFile(test.ctx, {
        ownerId: ALICE,
        body: endless(),
        name: "endless",
      }),
    ).toEqual({ ok: false, error: "files.too_large" });
    expect(chunksRead).toBe(3);
  });

  it("keeps an owner within the quota, counting only live files", async () => {
    test = await createTestFiles({ files: { quotaBytesPerOwner: 10 } });
    expect(
      (
        await saveFile(test.ctx, {
          ownerId: ALICE,
          body: chunked("123456"),
          name: "a",
          ttlSeconds: 3600,
        })
      ).ok,
    ).toBe(true);

    expect(
      await saveFile(test.ctx, {
        ownerId: ALICE,
        body: chunked("12345"),
        name: "b",
      }),
    ).toEqual({ ok: false, error: "files.quota_exceeded" });
    expect(
      (
        await saveFile(test.ctx, {
          ownerId: BOB,
          body: chunked("12345"),
          name: "b",
        })
      ).ok,
    ).toBe(true);
    expect(
      (
        await saveFile(test.ctx, {
          ownerId: ALICE,
          body: chunked("1234"),
          name: "c",
        })
      ).ok,
    ).toBe(true);
    expect(await getOwnerUsage(test.ctx, ALICE)).toBe(10);
    expect(
      await saveFile(test.ctx, {
        ownerId: ALICE,
        body: chunked("1"),
        name: "d",
      }),
    ).toEqual({ ok: false, error: "files.quota_exceeded" });

    test.clock.advance(HOUR_MS);
    expect(await getOwnerUsage(test.ctx, ALICE)).toBe(4);
    expect(
      (
        await saveFile(test.ctx, {
          ownerId: ALICE,
          body: chunked("123456"),
          name: "e",
        })
      ).ok,
    ).toBe(true);
    expect(test.storage.objects().size).toBe(4);
  });

  it("lets only one of two concurrent saves take the last of the quota", async () => {
    test = await createTestFiles({ files: { quotaBytesPerOwner: 10 } });

    const results = await Promise.all([
      saveFile(test.ctx, {
        ownerId: ALICE,
        body: chunked("1234567"),
        name: "a",
      }),
      saveFile(test.ctx, {
        ownerId: ALICE,
        body: chunked("7654321"),
        name: "b",
      }),
    ]);

    expect(results.map((result) => (result.ok ? "ok" : result.error)).sort()).toEqual(["files.quota_exceeded", "ok"]);
    expect(test.storage.objects().size).toBe(1);
    expect(await getOwnerUsage(test.ctx, ALICE)).toBe(7);
  });

  it("answers an owner's existing file for the same content when dedupe is on", async () => {
    test = await createTestFiles({ files: { dedupe: true } });
    const first = await saveFile(test.ctx, {
      ownerId: ALICE,
      body: chunked("same bytes"),
      name: "a.bin",
    });
    const second = await saveFile(test.ctx, {
      ownerId: ALICE,
      body: chunked("same bytes", 3),
      name: "b.bin",
    });
    const other = await saveFile(test.ctx, {
      ownerId: BOB,
      body: chunked("same bytes"),
      name: "c.bin",
    });

    expect(first.ok && second.ok && second.value).toEqual(first.ok && first.value);
    expect(other.ok && other.value.id).not.toBe(first.ok && first.value.id);
    expect(test.storage.objects().size).toBe(2);
    expect(await listRows(test.database)).toEqual(["a.bin file 10", "c.bin file 10"]);
  });

  it("keeps two copies when dedupe is off", async () => {
    test = await createTestFiles();
    await saveFile(test.ctx, {
      ownerId: ALICE,
      body: chunked("same"),
      name: "a",
    });
    await saveFile(test.ctx, {
      ownerId: ALICE,
      body: chunked("same"),
      name: "b",
    });
    expect(test.storage.objects().size).toBe(2);
  });

  it("sets the expiry from expiresAt, ttlSeconds or defaultTtlSeconds, and the file stops being found after it", async () => {
    test = await createTestFiles({ files: { defaultTtlSeconds: 7200 } });
    const at = new Date(NOW.getTime() + 3 * HOUR_MS);

    const explicit = await saveFile(test.ctx, {
      ownerId: ALICE,
      body: chunked("a"),
      name: "a",
      expiresAt: at,
    });
    const ttl = await saveFile(test.ctx, {
      ownerId: ALICE,
      body: chunked("b"),
      name: "b",
      ttlSeconds: 60,
    });
    const fallback = await saveFile(test.ctx, {
      ownerId: ALICE,
      body: chunked("c"),
      name: "c",
    });

    expect([explicit, ttl, fallback].map((result) => result.ok && result.value.expiresAt)).toEqual([
      at,
      new Date(NOW.getTime() + 60_000),
      new Date(NOW.getTime() + 2 * HOUR_MS),
    ]);
    test.clock.advance(60_000);
    expect(ttl.ok && (await findFile(test.ctx, ttl.value.id))).toBeNull();
    expect(explicit.ok && (await findFile(test.ctx, explicit.value.id))?.name).toBe("a");
  });

  it.each([
    ["an empty owner", { ownerId: "" }],
    ["an owner over 200 characters", { ownerId: "x".repeat(201) }],
    ["a malformed kind", { kind: "Input Files" }],
    ["a malformed content type", { contentType: "not a type" }],
    ["an expiry in the past", { expiresAt: new Date(NOW.getTime() - 1) }],
    ["both expiresAt and ttlSeconds", { expiresAt: new Date(NOW.getTime() + HOUR_MS), ttlSeconds: 60 }],
    ["a ttl of zero", { ttlSeconds: 0 }],
  ])("refuses %s before reading the body", async (_label, overrides) => {
    test = await createTestFiles();
    let isRead = false;
    async function* body(): AsyncGenerator<Uint8Array> {
      isRead = true;
      await Promise.resolve();
      yield Buffer.from("x");
    }

    expect(
      await saveFile(test.ctx, {
        ownerId: ALICE,
        body: body(),
        name: "a",
        ...overrides,
      }),
    ).toEqual({ ok: false, error: "files.invalid_input" });
    expect(isRead).toBe(false);
  });

  it("lets a storage failure propagate and keeps no row", async () => {
    test = await createTestFiles();
    test.storage.setFailing(true);

    await expect(saveFile(test.ctx, { ownerId: ALICE, body: chunked("abc"), name: "a" })).rejects.toThrow(/put failed/);
    expect(await listRows(test.database)).toEqual([]);
  });

  it("lets a body that fails half way propagate and keeps nothing", async () => {
    test = await createTestFiles();
    async function* broken(): AsyncGenerator<Uint8Array> {
      await Promise.resolve();
      yield Buffer.from("abc");
      throw new Error("client went away");
    }

    await expect(saveFile(test.ctx, { ownerId: ALICE, body: broken(), name: "a" })).rejects.toThrow("client went away");
    expect(test.storage.objects().size).toBe(0);
    expect(await listRows(test.database)).toEqual([]);
  });
});
