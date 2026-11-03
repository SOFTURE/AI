// The browser sender against the real upload route: what it sends, what it skips when resuming, the progress it
// reports, the codes it answers, and the upload page running the very same source.
import { sendUpload, type SendUploadOptions, type UploadProgress } from "@softure-ai/files/client";
import { createUpload, finalizeUpload, getUpload, serveUpload, type FilesContext } from "@softure-ai/files/server";
import { runInThisContext, Script } from "node:vm";
import { afterEach, describe, expect, it } from "vitest";
import { ALICE, closeTestFiles, createTestFiles, HOUR_MS, type TestFiles } from "./support.js";

const CHUNK = 1024;
const CONTENT = "a".repeat(CHUNK) + "b".repeat(CHUNK) + "c".repeat(CHUNK / 2);
type Fetch = NonNullable<SendUploadOptions["fetch"]>;

describe("sendUpload", () => {
  let test: TestFiles;

  async function open(): Promise<{ ctx: FilesContext; url: string; id: string; requests: string[]; route: Fetch }> {
    test = await createTestFiles({ files: { uploads: { chunkBytes: CHUNK } } });
    const created = await createUpload(test.ctx, { ownerId: ALICE, name: "clip.mp4", contentType: "video/mp4", size: CONTENT.length });
    if (!created.ok) throw new Error(`setup: ${created.error}`);
    const ctx = test.ctx;
    const requests: string[] = [];
    const route: Fetch = (url, init) => {
      const request = new Request(url, init);
      requests.push(`${request.method} ${request.headers.get("content-range") ?? ""}`.trim());
      return serveUpload(ctx, request);
    };
    return { ctx, url: created.value.uploadUrl, id: created.value.uploadId, requests, route };
  }

  afterEach(closeTestFiles);

  it("sends every chunk in order with its range, reports progress, and the session finalizes", async () => {
    const { ctx, url, id, requests, route } = await open();
    const progress: UploadProgress[] = [];
    const sent = await sendUpload(new Blob([CONTENT]), { uploadUrl: url, fetch: route, onProgress: (step) => progress.push(step) });

    expect(sent).toEqual({ ok: true, value: { sentBytes: CONTENT.length, totalBytes: CONTENT.length } });
    expect(requests).toEqual(["HEAD", "PUT bytes 0-1023/2560", "PUT bytes 1024-2047/2560", "PUT bytes 2048-2559/2560"]);
    expect(progress.map((step) => step.sentBytes)).toEqual([0, 1024, 2048, 2560]);
    const finalized = await finalizeUpload(ctx, id);
    expect(finalized.ok && finalized.value.size).toBe(CONTENT.length);
  });

  it("sends only the chunks the session is missing when it resumes", async () => {
    const { ctx, url, id, requests, route } = await open();
    const middle = new Request(url, { method: "PUT", headers: { "content-range": "bytes 1024-2047/2560" }, body: CONTENT.slice(CHUNK, 2 * CHUNK) });
    expect((await serveUpload(ctx, middle)).status).toBe(200);
    const progress: number[] = [];

    const sent = await sendUpload(new Blob([CONTENT]), { uploadUrl: url, fetch: route, onProgress: (step) => progress.push(step.sentBytes) });

    expect(sent.ok).toBe(true);
    expect(requests).toEqual(["HEAD", "PUT bytes 0-1023/2560", "PUT bytes 2048-2559/2560"]);
    expect(progress).toEqual([1024, 2048, 2560]);
    expect((await getUpload(ctx, id))?.state).toBe("complete");
  });

  it("sends nothing to a session that already holds the file, finalized or not", async () => {
    const { ctx, url, id, requests, route } = await open();
    expect((await sendUpload(new Blob([CONTENT]), { uploadUrl: url, fetch: route })).ok).toBe(true);
    expect((await finalizeUpload(ctx, id)).ok).toBe(true);
    requests.length = 0;

    const again = await sendUpload(new Blob([CONTENT]), { uploadUrl: url, fetch: route });

    expect(again).toEqual({ ok: true, value: { sentBytes: CONTENT.length, totalBytes: CONTENT.length } });
    expect(requests).toEqual(["HEAD"]);
  });

  it("answers files.upload_expired for an expired session and files.upload_rejected for a file of another size", async () => {
    const { url, requests, route } = await open();
    expect(await sendUpload(new Blob([CONTENT.slice(1)]), { uploadUrl: url, fetch: route })).toEqual({ ok: false, error: "files.upload_rejected" });
    expect(requests).toEqual(["HEAD"]);

    test.clock.advance(24 * HOUR_MS);
    expect(await sendUpload(new Blob([CONTENT]), { uploadUrl: url, fetch: route })).toEqual({ ok: false, error: "files.upload_expired" });
  });

  it("maps a refused chunk to files.upload_rejected and 429 or 5xx to files.network", async () => {
    const { url, route } = await open();
    const answering =
      (status: number): Fetch =>
      async (target, init) =>
        init.method === "PUT" ? new Response(null, { status }) : route(target, init);

    expect(await sendUpload(new Blob([CONTENT]), { uploadUrl: url, fetch: answering(416) })).toEqual({ ok: false, error: "files.upload_rejected" });
    expect(await sendUpload(new Blob([CONTENT]), { uploadUrl: url, fetch: answering(400) })).toEqual({ ok: false, error: "files.upload_rejected" });
    expect(await sendUpload(new Blob([CONTENT]), { uploadUrl: url, fetch: answering(429) })).toEqual({ ok: false, error: "files.network" });
    expect(await sendUpload(new Blob([CONTENT]), { uploadUrl: url, fetch: answering(503) })).toEqual({ ok: false, error: "files.network" });
  });

  it("answers files.network when a request throws", async () => {
    const { url, route } = await open();
    let calls = 0;
    const dropping: Fetch = (target, init) => {
      calls += 1;
      return calls === 3 ? Promise.reject(new TypeError("Failed to fetch")) : route(target, init);
    };
    expect(await sendUpload(new Blob([CONTENT]), { uploadUrl: url, fetch: dropping })).toEqual({ ok: false, error: "files.network" });
  });

  it("stops at the abort and answers files.upload_aborted; a later send resumes", async () => {
    const { ctx, url, id, requests, route } = await open();
    const controller = new AbortController();
    const aborted = await sendUpload(new Blob([CONTENT]), {
      uploadUrl: url,
      fetch: route,
      signal: controller.signal,
      onProgress: (step) => {
        if (step.sentBytes === CHUNK) controller.abort();
      },
    });
    expect(aborted).toEqual({ ok: false, error: "files.upload_aborted" });
    expect(requests).toEqual(["HEAD", "PUT bytes 0-1023/2560"]);

    expect(await sendUpload(new Blob([CONTENT]), { uploadUrl: url, fetch: route, signal: AbortSignal.abort() })).toEqual({
      ok: false,
      error: "files.upload_aborted",
    });
    expect((await sendUpload(new Blob([CONTENT]), { uploadUrl: url, fetch: route })).ok).toBe(true);
    expect((await getUpload(ctx, id))?.receivedBytes).toBe(CONTENT.length);
  });

  it("is the loop of the upload page: the page's inlined source runs on its own", async () => {
    const { ctx, url, id, route } = await open();
    const page = await serveUpload(ctx, new Request(url, { headers: { accept: "text/html" } }));
    const script = /<script nonce="[^"]+">([\s\S]*?)<\/script>/.exec(await page.text())?.[1] ?? "";
    expect(script.startsWith("async function sendUpload(")).toBe(true);
    // The whole page script compiles, and the sender part of it works without anything around it.
    expect(() => new Script(script)).not.toThrow();
    const source = script.slice(0, script.indexOf("\nconst config"));
    const inlined = runInThisContext(`(${source})`) as typeof sendUpload;

    expect(await inlined(new Blob([CONTENT]), { uploadUrl: url, fetch: route })).toEqual({ ok: true, value: { sentBytes: 2560, totalBytes: 2560 } });
    expect((await getUpload(ctx, id))?.state).toBe("complete");
  });
});
