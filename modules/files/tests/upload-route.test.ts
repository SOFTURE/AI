// The upload route: PUT chunks with Content-Range, HEAD and GET to resume, the browser page, one 404 for dead URLs,
// and the rate limit when the security module is on.
import { FILES_RATE_LIMIT_BUCKETS } from "@softure-ai/files";
import { createUpload, finalizeUpload, serveUpload, type FilesContext } from "@softure-ai/files/server";
import { headerIp, security } from "@softure-ai/security";
import { afterEach, describe, expect, it } from "vitest";
import { ALICE, chunked, closeTestFiles, createTestFiles, HOUR_MS, type TestFiles } from "./support.js";

const CHUNK = 1024;
const CONTENT = "a".repeat(CHUNK) + "b".repeat(CHUNK / 2);

describe("the upload route", () => {
  let test: TestFiles;

  async function open(options: Parameters<typeof createTestFiles>[0] = {}): Promise<{ ctx: FilesContext; url: string; id: string }> {
    test = await createTestFiles({ ...options, files: { uploads: { chunkBytes: CHUNK } } });
    const created = await createUpload(test.ctx, { ownerId: ALICE, name: "clip <1>.mp4", contentType: "video/mp4", size: CONTENT.length });
    if (!created.ok) throw new Error(`setup: ${created.error}`);
    return { ctx: test.ctx, url: created.value.uploadUrl, id: created.value.uploadId };
  }

  function put(ctx: FilesContext, url: string, body: string, contentRange?: string): Promise<Response> {
    const headers: Record<string, string> = contentRange === undefined ? {} : { "content-range": contentRange };
    return serveUpload(ctx, new Request(url, { method: "PUT", headers, body }));
  }

  afterEach(closeTestFiles);

  it("takes chunks, answers what arrived in HEAD and GET, and the session finalizes", async () => {
    const { ctx, url, id } = await open();
    const second = await put(ctx, url, CONTENT.slice(CHUNK), `bytes ${String(CHUNK)}-${String(CONTENT.length - 1)}/${String(CONTENT.length)}`);
    expect(second.status).toBe(200);
    expect(second.headers.get("cache-control")).toBe("private, no-store");

    const head = await serveUpload(ctx, new Request(url, { method: "HEAD" }));
    expect(head.status).toBe(200);
    expect(Object.fromEntries([...head.headers].filter(([name]) => name.startsWith("upload-")))).toEqual({
      "upload-state": "open",
      "upload-size": String(CONTENT.length),
      "upload-chunk-size": String(CHUNK),
      "upload-received": `${String(CHUNK)}-${String(CONTENT.length - 1)}`,
      "upload-expires": new Date(test.clock.now().getTime() + 24 * HOUR_MS).toISOString(),
    });
    const status = (await (await serveUpload(ctx, new Request(url))).json()) as Record<string, unknown>;
    expect(status).toMatchObject({ uploadId: id, missingChunks: [0], receivedBytes: CHUNK / 2, state: "open" });

    const first = await put(ctx, url, CONTENT.slice(0, CHUNK), `bytes 0-${String(CHUNK - 1)}/${String(CONTENT.length)}`);
    expect(((await first.json()) as Record<string, unknown>).state).toBe("complete");
    const finalized = await finalizeUpload(ctx, id);
    expect(finalized.ok && finalized.value.size).toBe(CONTENT.length);
    expect((await put(ctx, url, CONTENT.slice(0, CHUNK), `bytes 0-${String(CHUNK - 1)}/${String(CONTENT.length)}`)).status).toBe(404);
  });

  it("refuses a malformed range, a range that is not a chunk and a body of the wrong length", async () => {
    const { ctx, url } = await open();
    expect((await put(ctx, url, "x", "bytes=0-0")).status).toBe(416);
    expect((await put(ctx, url, CONTENT, undefined)).status).toBe(416);
    expect((await put(ctx, url, "x".repeat(10), `bytes 0-9/${String(CONTENT.length)}`)).status).toBe(416);
    const wrong = await put(ctx, url, "x".repeat(10), `bytes 0-${String(CHUNK - 1)}/${String(CONTENT.length)}`);
    expect(wrong.status).toBe(400);
    expect(await wrong.json()).toEqual({ error: "files.chunk_length_mismatch" });
  });

  it("answers one 404 for a forged, expired or unknown URL, and 405 for other methods", async () => {
    const { ctx, url } = await open();
    const forged = url.replace(/.{4}$/, "AAAA");
    for (const target of [forged, `${url}/extra`, url.replace("/u/", "/f/")]) {
      expect((await serveUpload(ctx, new Request(target))).status).toBe(404);
    }
    expect((await serveUpload(ctx, new Request(url, { method: "DELETE" }))).status).toBe(405);
    test.clock.advance(24 * HOUR_MS);
    expect((await serveUpload(ctx, new Request(url))).status).toBe(404);
  });

  it("serves the browser page with a nonce CSP and escaped copy", async () => {
    const { ctx, url } = await open();
    const page = await serveUpload(ctx, new Request(url, { headers: { accept: "text/html,application/xhtml+xml" } }));
    expect(page.status).toBe(200);
    expect(page.headers.get("content-type")).toBe("text/html; charset=utf-8");
    const csp = page.headers.get("content-security-policy") ?? "";
    const nonce = /script-src 'nonce-([^']+)'/.exec(csp)?.[1];
    expect(nonce).toBeDefined();
    const html = await page.text();
    expect(html).toContain(`<script nonce="${nonce ?? ""}">`);
    expect(html).toContain("clip &#60;1&#62;.mp4");
    expect(html).toContain("Upload a file");
  });

  it("counts requests in the security bucket and answers 429 past the limit", async () => {
    const limited = security({ clientIp: headerIp("x-real-ip"), buckets: { "files-upload": { ...FILES_RATE_LIMIT_BUCKETS["files-upload"], limit: 2 } } });
    const { ctx, url } = await open({ extraModules: [limited] });
    expect((await serveUpload(ctx, new Request(url, { method: "HEAD" }))).status).toBe(200);
    expect((await serveUpload(ctx, new Request(url, { method: "HEAD" }))).status).toBe(200);
    const refused = await serveUpload(ctx, new Request(url, { method: "HEAD" }));
    expect(refused.status).toBe(429);
    expect(Number(refused.headers.get("retry-after"))).toBeGreaterThan(0);
  });

  it("throws a setup error when the security module lacks the bucket", async () => {
    const { ctx, url } = await open({ extraModules: [security({ clientIp: headerIp("x-real-ip"), buckets: { other: { limit: 1, windowMinutes: 1 } } })] });
    await expect(serveUpload(ctx, new Request(url))).rejects.toThrow(/FILES_RATE_LIMIT_BUCKETS/);
  });

  it("streams a request body chunk by chunk", async () => {
    const { ctx, url } = await open();
    const body = new ReadableStream<Uint8Array>({
      async start(controller) {
        for await (const part of chunked(CONTENT.slice(0, CHUNK), 100)) controller.enqueue(part);
        controller.close();
      },
    });
    const request = new Request(url, { method: "PUT", headers: { "content-range": `bytes 0-${String(CHUNK - 1)}/${String(CONTENT.length)}` }, body, duplex: "half" } as RequestInit);
    expect((await serveUpload(ctx, request)).status).toBe(200);
  });
});
