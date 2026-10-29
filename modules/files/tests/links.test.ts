// Public links: signed, expiring, revocable; served with ranges and safe headers; one 404 for every dead link,
// decided before any database read for a forged or expired one.
import { createFileLink, deleteFile, revokeFileLinks, saveFile, serveFileLink, verifyFileLink } from "@softure-ai/files/server";
import type { StoredFile } from "@softure-ai/files";
import { createTestLinkKeys, fetchFileLink, readFileLinkExpiry } from "@softure-ai/files/testing";
import { afterEach, describe, expect, it } from "vitest";
import { ALICE, BOB, chunked, closeTestFiles, createTestFiles, HOUR_MS, NOW, type TestFiles } from "./support.js";

const DIGITS = "0123456789";
const NOT_FOUND_HEADERS = {
  "cache-control": "private, no-store",
  "content-type": "text/plain; charset=utf-8",
  "referrer-policy": "no-referrer",
  "x-content-type-options": "nosniff",
};

describe("file links", () => {
  let test: TestFiles;

  async function save(options: { name?: string; content?: string; ttlSeconds?: number } = {}): Promise<StoredFile> {
    const saved = await saveFile(test.ctx, {
      ownerId: ALICE,
      body: chunked(options.content ?? DIGITS),
      name: options.name ?? "digits.txt",
      contentType: "text/plain",
      ttlSeconds: options.ttlSeconds,
    });
    if (!saved.ok) throw new Error(`setup: ${saved.error}`);
    return saved.value;
  }

  async function link(file: StoredFile, ttlSeconds = 3600, downloadName?: string): Promise<string> {
    const created = await createFileLink(test.ctx, file.id, {
      ttlSeconds,
      downloadName,
    });
    if (!created.ok) throw new Error(`setup: ${created.error}`);
    return created.value.url;
  }

  async function expectNotFound(url: string): Promise<void> {
    const answer = await fetchFileLink(test.ctx, url);
    expect({
      status: answer.status,
      headers: answer.headers,
      body: Buffer.from(answer.body).toString(),
    }).toEqual({
      status: 404,
      headers: { ...NOT_FOUND_HEADERS, "content-length": "10" },
      body: "Not found\n",
    });
  }

  afterEach(closeTestFiles);

  it("makes an absolute link on the app's origin that expires after its ttl", async () => {
    test = await createTestFiles();
    const file = await save();

    const created = await createFileLink(test.ctx, file.id, {
      ttlSeconds: 600,
    });

    const expiry = String(NOW.getTime() / 1000 + 600);
    expect(created.ok && created.value.path).toMatch(new RegExp(`^/f/${file.id}/${expiry}/1\\.[A-Za-z0-9_-]{43}/digits\\.txt$`));
    expect(created.ok && created.value.url).toBe(created.ok && `https://app.example.com${created.value.path}`);
    expect(created.ok && created.value.expiresAt).toEqual(new Date(NOW.getTime() + 600_000));
    expect(created.ok && readFileLinkExpiry(created.value.url)).toEqual(new Date(NOW.getTime() + 600_000));
  });

  it("serves the whole file with its headers", async () => {
    test = await createTestFiles();
    const answer = await fetchFileLink(test.ctx, await link(await save()));

    expect(answer.status).toBe(200);
    expect(Buffer.from(answer.body).toString()).toBe(DIGITS);
    expect(answer.headers).toEqual({
      "accept-ranges": "bytes",
      "cache-control": "private, no-store",
      "content-disposition": `attachment; filename="digits.txt"; filename*=UTF-8''digits.txt`,
      "content-length": "10",
      "content-security-policy": "sandbox; default-src 'none'",
      "content-type": "text/plain",
      "referrer-policy": "no-referrer",
      "x-content-type-options": "nosniff",
    });
  });

  it("answers HEAD with the GET headers and no body", async () => {
    test = await createTestFiles();
    const url = await link(await save());

    const head = await fetchFileLink(test.ctx, url, { method: "HEAD" });
    const get = await fetchFileLink(test.ctx, url);

    expect(head.status).toBe(200);
    expect(head.body.byteLength).toBe(0);
    expect(head.headers).toEqual(get.headers);
  });

  it.each([
    ["bytes=0-3", 206, "0123", "bytes 0-3/10"],
    ["bytes=7-", 206, "789", "bytes 7-9/10"],
    ["bytes=-2", 206, "89", "bytes 8-9/10"],
    ["bytes=5-100", 206, "56789", "bytes 5-9/10"],
    ["bytes=-50", 206, DIGITS, "bytes 0-9/10"],
    ["bytes=0-1,4-5", 200, DIGITS, undefined],
    ["bytes=5-2", 200, DIGITS, undefined],
    ["items=0-3", 200, DIGITS, undefined],
  ])("answers Range %s with %i", async (range, status, body, contentRange) => {
    test = await createTestFiles();
    const answer = await fetchFileLink(test.ctx, await link(await save()), {
      range,
    });

    expect([answer.status, Buffer.from(answer.body).toString(), answer.headers["content-range"]]).toEqual([status, body, contentRange]);
    expect(answer.headers["content-length"]).toBe(String(body.length));
  });

  it.each(["bytes=10-", "bytes=-0"])("answers an unsatisfiable Range %s with 416 and the size", async (range) => {
    test = await createTestFiles();
    const answer = await fetchFileLink(test.ctx, await link(await save()), {
      range,
    });

    expect([answer.status, answer.headers["content-range"], answer.body.byteLength]).toEqual([416, "bytes */10", 0]);
  });

  it("answers a ranged HEAD with 206 and the range's length", async () => {
    test = await createTestFiles();
    const answer = await fetchFileLink(test.ctx, await link(await save()), {
      method: "HEAD",
      range: "bytes=2-5",
    });

    expect([answer.status, answer.headers["content-length"], answer.headers["content-range"], answer.body.byteLength]).toEqual([
      206,
      "4",
      "bytes 2-5/10",
      0,
    ]);
  });

  it("sends a non-ASCII download name with an ASCII fallback, and signs the name", async () => {
    test = await createTestFiles();
    const url = await link(await save(), 3600, 'Résumé "final".txt');

    const answer = await fetchFileLink(test.ctx, url);
    expect(answer.headers["content-disposition"]).toBe(
      `attachment; filename="R_sum_ _final_.txt"; filename*=UTF-8''R%C3%A9sum%C3%A9%20%22final%22.txt`,
    );
    await expectNotFound(url.replace(/\/[^/]+$/, "/other.txt"));
  });

  it("serves inline when the app asks for it", async () => {
    test = await createTestFiles({
      files: { links: { disposition: "inline" } },
    });
    const answer = await fetchFileLink(test.ctx, await link(await save()));
    expect(answer.headers["content-disposition"]).toMatch(/^inline; /);
  });

  it("stops working at its expiry", async () => {
    test = await createTestFiles();
    const url = await link(await save(), 60);

    test.clock.advance(59_000);
    expect((await fetchFileLink(test.ctx, url)).status).toBe(200);
    test.clock.advance(1000);
    await expectNotFound(url);
  });

  it("ends with a file that expires before the link would", async () => {
    test = await createTestFiles();
    const file = await save({ ttlSeconds: 120 });

    const created = await createFileLink(test.ctx, file.id, {
      ttlSeconds: 3600,
    });

    expect(created.ok && created.value.expiresAt).toEqual(new Date(NOW.getTime() + 120_000));
    test.clock.advance(120_000);
    await expectNotFound(created.ok ? created.value.url : "");
  });

  it("stops every earlier link when revoked, and works again with a new link", async () => {
    test = await createTestFiles();
    const file = await save();
    const before = await link(file);

    expect(await revokeFileLinks(test.ctx, file.id, { ownerId: BOB })).toEqual({
      ok: false,
      error: "files.not_found",
    });
    expect(await revokeFileLinks(test.ctx, file.id)).toEqual({
      ok: true,
      value: undefined,
    });

    await expectNotFound(before);
    const after = await link(file);
    expect(after).toContain(`/2.`);
    expect((await fetchFileLink(test.ctx, after)).status).toBe(200);
  });

  it("stops working when the file is deleted", async () => {
    test = await createTestFiles();
    const file = await save();
    const url = await link(file);

    await deleteFile(test.ctx, file.id);

    await expectNotFound(url);
  });

  it.each([
    ["a changed id", (url: string) => url.replace(/\/f\/[0-9a-f-]{36}\//, "/f/00000000-0000-4000-8000-000000000000/")],
    ["a later expiry", (url: string) => url.replace(/\/(\d+)\//, (_m, expiry: string) => `/${String(Number(expiry) + 3600)}/`)],
    ["a raised generation", (url: string) => url.replace(/\/1\./, "/2.")],
    ["a changed MAC", (url: string) => url.replace(/\/1\.([A-Za-z0-9_-])/, (_m, char: string) => `/1.${char === "A" ? "B" : "A"}`)],
    ["an extra segment", (url: string) => `${url}/more`],
    ["a missing segment", (url: string) => url.replace(/\/[^/]+$/, "")],
    ["a broken escape in the name", (url: string) => url.replace(/\/[^/]+$/, "/%E0%A4%A")],
    ["another route", (url: string) => url.replace("/f/", "/g/")],
  ])("answers the same 404 for a link with %s", async (_label, tamper) => {
    test = await createTestFiles();
    await expectNotFound(tamper(await link(await save())));
  });

  it("decides a forged or expired link without reading the database", async () => {
    test = await createTestFiles();
    const url = await link(await save(), 60);
    const blind = {
      ...test.ctx,
      db: new Proxy(test.ctx.db, {
        get() {
          throw new Error("test: the database was read");
        },
      }),
    };

    expect((await serveFileLink(blind, new Request(url.replace(/\/1\.[\w-]{43}\//, `/1.${"A".repeat(43)}/`)))).status).toBe(404);
    test.clock.advance(60_000);
    expect((await serveFileLink(blind, new Request(url))).status).toBe(404);
  });

  it("verifies under every key of the keyring and signs with the first", async () => {
    test = await createTestFiles({ keys: ["old"] });
    const url = await link(await save());

    const rotated = { ...test.ctx, env: createTestLinkKeys(["new", "old"]) };
    expect((await fetchFileLink(rotated, url)).status).toBe(200);
    const created = await createFileLink(rotated, (await save()).id, {
      ttlSeconds: 60,
    });
    const dropped = { ...test.ctx, env: createTestLinkKeys(["new"]) };
    expect((await fetchFileLink(dropped, url)).status).toBe(404);
    expect((await fetchFileLink(dropped, created.ok ? created.value.url : "")).status).toBe(200);
  });

  it("answers a key problem as a code when making a link and as the 404 when serving one", async () => {
    test = await createTestFiles();
    const file = await save();
    const url = await link(file);

    expect(
      await createFileLink({ ...test.ctx, env: {} }, file.id, {
        ttlSeconds: 60,
      }),
    ).toEqual({ ok: false, error: "files.link_key_missing" });
    expect(await createFileLink({ ...test.ctx, env: { SOFTURE_FILES_LINK_KEYS: "a:short" } }, file.id, { ttlSeconds: 60 })).toEqual({
      ok: false,
      error: "files.link_key_invalid",
    });
    expect(verifyFileLink({ ...test.ctx, env: {} }, new URL(url).pathname)).toEqual({ ok: false, error: "files.link_key_missing" });
    expect((await fetchFileLink({ ...test.ctx, env: {} }, url)).status).toBe(404);
  });

  it("refuses a ttl outside 1 second to links.maxTtlSeconds, and a file that is not live", async () => {
    test = await createTestFiles({ files: { links: { maxTtlSeconds: 3600 } } });
    const file = await save();

    expect(await createFileLink(test.ctx, file.id, { ttlSeconds: 3601 })).toEqual({ ok: false, error: "files.invalid_input" });
    expect(await createFileLink(test.ctx, file.id, { ttlSeconds: 0 })).toEqual({
      ok: false,
      error: "files.invalid_input",
    });
    expect(await createFileLink(test.ctx, file.id, { ttlSeconds: 60, ownerId: BOB })).toEqual({ ok: false, error: "files.not_found" });
    expect(await createFileLink(test.ctx, "nope", { ttlSeconds: 60 })).toEqual({
      ok: false,
      error: "files.not_found",
    });
  });

  it("serves a link under the app's own route", async () => {
    test = await createTestFiles({ files: { routes: { links: "/media///" } } });
    const url = await link(await save());

    expect(new URL(url).pathname.startsWith("/media/")).toBe(true);
    expect((await fetchFileLink(test.ctx, url)).status).toBe(200);
  });

  it("refuses methods other than GET and HEAD", async () => {
    test = await createTestFiles();
    const response = await serveFileLink(test.ctx, new Request(await link(await save()), { method: "POST" }));
    expect([response.status, response.headers.get("allow")]).toEqual([405, "GET, HEAD"]);
  });

  it("answers the 404 for a file whose bytes are gone from storage", async () => {
    test = await createTestFiles();
    const url = await link(await save());
    for (const key of test.storage.objects().keys()) await test.storage.delete(key);

    await expectNotFound(url);
    expect((await fetchFileLink(test.ctx, url, { method: "HEAD" })).status).toBe(200);
    test.clock.advance(HOUR_MS);
  });
});
