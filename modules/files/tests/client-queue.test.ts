// The upload list against the real upload route: sessions opened and finalized by app callbacks, concurrency, pause
// and resume without sending a chunk twice, remove, failures with their copy and retry.
import type { ErrorCode, Result } from "@softure-ai/core";
import { createUploadQueue, type SendUploadOptions, type UploadQueue, type UploadQueueOptions } from "@softure-ai/files/client";
import type { CreatedUpload } from "@softure-ai/files";
import { createUpload, finalizeUpload, serveUpload, type FilesContext } from "@softure-ai/files/server";
import { afterEach, describe, expect, it } from "vitest";
import { ALICE, closeTestFiles, createTestFiles, HOUR_MS, type TestFiles } from "./support.js";

const CHUNK = 1024;
const CONTENT = "a".repeat(CHUNK) + "b".repeat(CHUNK) + "c".repeat(CHUNK / 2);
type Fetch = NonNullable<SendUploadOptions["fetch"]>;

/** Resolves once nothing in the list is queued or uploading. */
function settle(queue: UploadQueue): Promise<void> {
  return new Promise((resolve) => {
    const check = (): void => {
      if (queue.getItems().every((item) => item.state !== "queued" && item.state !== "uploading")) {
        stop();
        resolve();
      }
    };
    const stop = queue.subscribe(check);
    check();
  });
}

describe("createUploadQueue", () => {
  let test: TestFiles;
  let ctx: FilesContext;
  let requests: string[];
  let opened: number;
  let finalized: string[];

  async function setup(overrides: Partial<UploadQueueOptions<CreatedUpload>> = {}): Promise<UploadQueue> {
    test = await createTestFiles({ files: { uploads: { chunkBytes: CHUNK } } });
    ctx = test.ctx;
    requests = [];
    opened = 0;
    finalized = [];
    const route: Fetch = (url, init) => {
      const request = new Request(url, init);
      requests.push(`${request.method} ${request.headers.get("content-range") ?? ""}`.trim());
      return serveUpload(ctx, request);
    };
    return createUploadQueue<CreatedUpload>({
      open: async (file): Promise<Result<CreatedUpload>> => {
        opened += 1;
        return createUpload(ctx, { ownerId: ALICE, name: file.name, contentType: "video/mp4", size: file.size });
      },
      finalize: async (session): Promise<Result<unknown>> => {
        const answer = await finalizeUpload(ctx, session.uploadId);
        if (answer.ok) finalized.push(session.uploadId);
        return answer;
      },
      fetch: route,
      ...overrides,
    });
  }

  afterEach(closeTestFiles);

  it("opens, sends and finalizes each file, and the item ends done at 100", async () => {
    const queue = await setup();
    const progress: number[] = [];
    queue.subscribe(() => {
      const item = queue.getItems()[0];
      if (item !== undefined && progress.at(-1) !== item.progress) progress.push(item.progress);
    });

    const ids = queue.add([new File([CONTENT], "clip.mp4")]);
    await settle(queue);

    expect(ids).toEqual(["upload-1"]);
    expect(queue.getItems()).toEqual([{ id: "upload-1", name: "clip.mp4", size: CONTENT.length, state: "done", progress: 100 }]);
    expect(progress).toEqual([0, 40, 80, 99, 100]);
    expect(opened).toBe(1);
    expect(finalized).toHaveLength(1);
  });

  it("runs one upload at a time by default and more with concurrency", async () => {
    const serial = await setup();
    serial.add([new File([CONTENT], "one.mp4"), new File([CONTENT], "two.mp4")]);
    expect(serial.getItems().map((item) => item.state)).toEqual(["uploading", "queued"]);
    await settle(serial);
    expect(serial.getItems().map((item) => item.state)).toEqual(["done", "done"]);
    await closeTestFiles();

    const parallel = await setup({ concurrency: 2 });
    parallel.add([new File([CONTENT], "one.mp4"), new File([CONTENT], "two.mp4"), new File([CONTENT], "three.mp4")]);
    expect(parallel.getItems().map((item) => item.state)).toEqual(["uploading", "uploading", "queued"]);
    await settle(parallel);
    expect(finalized).toHaveLength(3);
  });

  it("answers the same array until something changes", async () => {
    const queue = await setup();
    expect(queue.getItems()).toBe(queue.getItems());
    const before = queue.getItems();
    queue.add([new File([CONTENT], "clip.mp4")]);
    expect(queue.getItems()).not.toBe(before);
    await settle(queue);
    expect(queue.getItems()).toBe(queue.getItems());
  });

  it("pauses mid-upload, keeps the session, and resumes without sending a chunk twice", async () => {
    const queue = await setup();
    const [id = ""] = queue.add([new File([CONTENT], "clip.mp4")]);
    const stop = queue.subscribe(() => {
      if (queue.getItems()[0]?.progress === 40) {
        stop();
        queue.pause(id);
      }
    });
    await settle(queue);
    expect(queue.getItems()[0]).toMatchObject({ state: "paused", progress: 40 });

    queue.resume(id);
    await settle(queue);

    expect(queue.getItems()[0]).toMatchObject({ state: "done", progress: 100 });
    expect(opened).toBe(1);
    const puts = requests.filter((request) => request.startsWith("PUT"));
    expect(new Set(puts).size).toBe(puts.length);
    expect(puts).toHaveLength(3);
  });

  it("keeps a session opened while the item was paused, so the resume opens no second one", async () => {
    let release: () => void = () => undefined;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    let markOpened: () => void = () => undefined;
    const openedSession = new Promise<void>((resolve) => {
      markOpened = resolve;
    });
    const queue = await setup({
      open: async (file) => {
        opened += 1;
        await gate;
        const created = await createUpload(ctx, { ownerId: ALICE, name: file.name, contentType: "video/mp4", size: file.size });
        markOpened();
        return created;
      },
    });
    const [id = ""] = queue.add([new File([CONTENT], "clip.mp4")]);
    queue.pause(id);
    release();
    await openedSession;
    // The queue takes the answer on the next turn of the event loop.
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(queue.getItems()[0]?.state).toBe("paused");

    queue.resume(id);
    await settle(queue);
    expect(queue.getItems()[0]?.state).toBe("done");
    expect(opened).toBe(1);
  });

  it("removes an upload: it is stopped, dropped from the list and never finalized", async () => {
    const queue = await setup();
    const [first = "", second = ""] = queue.add([new File([CONTENT], "one.mp4"), new File([CONTENT], "two.mp4")]);
    queue.remove(first);
    expect(queue.getItems().map((item) => item.id)).toEqual([second]);
    await settle(queue);
    expect(queue.getItems()).toMatchObject([{ id: second, state: "done" }]);
    expect(finalized).toHaveLength(1);
  });

  it("fails with the code and its copy when open fails, and a retry recovers", async () => {
    let refuse = true;
    const queue = await setup({
      open: async (file) => {
        opened += 1;
        if (refuse) return { ok: false, error: "files.too_many_uploads" };
        return createUpload(ctx, { ownerId: ALICE, name: file.name, contentType: "video/mp4", size: file.size });
      },
    });
    const [id = ""] = queue.add([new File([CONTENT], "clip.mp4")]);
    await settle(queue);
    expect(queue.getItems()[0]).toEqual({
      id,
      name: "clip.mp4",
      size: CONTENT.length,
      state: "failed",
      progress: 0,
      errorCode: "files.too_many_uploads",
      error: "Too many uploads are in progress. Finish or wait for one first.",
    });

    refuse = false;
    queue.retry(id);
    await settle(queue);
    expect(queue.getItems()[0]).toEqual({ id, name: "clip.mp4", size: CONTENT.length, state: "done", progress: 100 });
  });

  it("fails on a dropped connection and a retry sends only what is missing in the same session", async () => {
    let drop = true;
    await setup();
    let calls = 0;
    const flaky: Fetch = (url, init) => {
      calls += 1;
      if (drop && calls === 3) return Promise.reject(new TypeError("Failed to fetch"));
      const request = new Request(url, init);
      requests.push(`${request.method} ${request.headers.get("content-range") ?? ""}`.trim());
      return serveUpload(ctx, request);
    };
    const flakyQueue = createUploadQueue<CreatedUpload>({
      open: (file) => createUpload(ctx, { ownerId: ALICE, name: file.name, contentType: "video/mp4", size: file.size }),
      finalize: (session) => finalizeUpload(ctx, session.uploadId),
      fetch: flaky,
      describeError: (code: ErrorCode) => `failed: ${code}`,
    });
    const [id = ""] = flakyQueue.add([new File([CONTENT], "clip.mp4")]);
    await settle(flakyQueue);
    expect(flakyQueue.getItems()[0]).toMatchObject({ state: "failed", progress: 40, errorCode: "files.network", error: "failed: files.network" });

    drop = false;
    requests.length = 0;
    flakyQueue.retry(id);
    await settle(flakyQueue);
    expect(flakyQueue.getItems()[0]?.state).toBe("done");
    expect(requests).toEqual(["HEAD", "PUT bytes 1024-2047/2560", "PUT bytes 2048-2559/2560"]);
  });

  it("opens a new session on retry after the old one expired", async () => {
    const queue = await setup();
    const [id = ""] = queue.add([new File([CONTENT], "clip.mp4")]);
    const stop = queue.subscribe(() => {
      if (queue.getItems()[0]?.progress === 40) {
        stop();
        queue.pause(id);
      }
    });
    await settle(queue);
    test.clock.advance(24 * HOUR_MS);
    queue.resume(id);
    await settle(queue);
    expect(queue.getItems()[0]).toMatchObject({ state: "failed", errorCode: "files.upload_expired", error: "This upload has expired. Start it again." });

    queue.retry(id);
    await settle(queue);
    expect(queue.getItems()[0]?.state).toBe("done");
    expect(opened).toBe(2);
  });

  it("fails with files.network when the app's finalize throws, and stops notifying an unsubscribed listener", async () => {
    const queue = await setup({
      finalize: () => Promise.reject(new Error("server action failed")),
    });
    let calls = 0;
    const unsubscribe = queue.subscribe(() => {
      calls += 1;
    });
    unsubscribe();
    const errors: unknown[] = [];
    const original = console.error;
    console.error = (...args: unknown[]) => errors.push(args[0]);
    try {
      queue.add([new File([CONTENT], "clip.mp4")]);
      await settle(queue);
    } finally {
      console.error = original;
    }
    expect(queue.getItems()[0]).toMatchObject({ state: "failed", errorCode: "files.network" });
    expect(errors).toEqual(['@softure-ai/files/client: an upload of "clip.mp4" stopped on a thrown open or finalize']);
    expect(calls).toBe(0);
  });
});
