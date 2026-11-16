// The page's kept files (MR-344 of an adopting app, #1255): a list of `{ url, sha256, bytes }` downloaded into the
// cache within a byte budget, replaced by a new sha256, pruned when it leaves the list, read back as a Blob, and cleared
// on sign-out through clearDeviceData.
import { createHash } from "node:crypto";

import { clearDeviceData, createKeptFiles, KEPT_SHA256_HEADER, type KeptFile, type KeptFilesDependencies } from "@softure-ai/pwa";
import { afterEach, describe, expect, it } from "vitest";

import { FakeCacheStorage, ORIGIN } from "./support/fake-worker-scope.js";

function sha256(text: string): string {
  return createHash("sha256").update(text).digest("hex");
}

function file(path: string, body: string): KeptFile {
  return { url: path, sha256: sha256(body), bytes: Buffer.byteLength(body) };
}

interface Server {
  readonly bodies: Map<string, string>;
  readonly requested: string[];
  readonly inits: RequestInit[];
  failing: Set<string>;
}

function createServer(bodies: Record<string, string>): Server {
  return { bodies: new Map(Object.entries(bodies).map(([path, body]) => [`${ORIGIN}${path}`, body])), requested: [], inits: [], failing: new Set() };
}

const unregisters: (() => void)[] = [];
afterEach(() => {
  for (const unregister of unregisters.splice(0)) unregister();
});

function setUp(server: Server, budgetBytes = 1000): { kept: ReturnType<typeof createKeptFiles>; storage: FakeCacheStorage } {
  const storage = new FakeCacheStorage();
  const dependencies: KeptFilesDependencies = {
    caches: storage as unknown as CacheStorage,
    origin: ORIGIN,
    fetch: (url, init) => {
      server.requested.push(url);
      server.inits.push(init);
      if (server.failing.has(url)) return Promise.reject(new TypeError("Failed to fetch"));
      const body = server.bodies.get(url);
      return Promise.resolve(body === undefined ? new Response("missing", { status: 404 }) : new Response(body, { headers: { "content-type": "application/pdf" } }));
    },
  };
  const kept = createKeptFiles({ app: "trip", cache: "documents", budgetBytes }, dependencies);
  unregisters.push(kept.unregister);
  return { kept, storage };
}

describe("createKeptFiles (MR-344)", () => {
  it("MR-344 downloads the listed files into <app>-<cache> with their hash, and reports what it kept", async () => {
    const server = createServer({ "/api/documents/a": "AAAA", "/api/documents/b": "BBBBBB" });
    const { kept, storage } = setUp(server);

    const result = await kept.sync([file("/api/documents/a", "AAAA"), file("/api/documents/b", "BBBBBB")]);

    expect(kept.cacheName).toBe("trip-documents");
    expect(result).toEqual({
      kept: [`${ORIGIN}/api/documents/a`, `${ORIGIN}/api/documents/b`],
      bytesKept: 10,
      downloaded: [`${ORIGIN}/api/documents/a`, `${ORIGIN}/api/documents/b`],
      removed: [],
      skipped: [],
    });
    expect(storage.get("trip-documents").getPaths()).toEqual(["/api/documents/a", "/api/documents/b"]);
    const response = await storage.get("trip-documents").match(`${ORIGIN}/api/documents/a`);
    expect([response?.headers.get(KEPT_SHA256_HEADER), response?.headers.get("content-type"), response?.headers.get("content-length")]).toEqual([
      sha256("AAAA"),
      "application/pdf",
      "4",
    ]);
    expect(server.inits[0]).toEqual({ credentials: "same-origin", cache: "no-store", redirect: "error" });
    expect(await kept.getUsage()).toEqual({ files: 2, bytes: 10 });
  });

  it("MR-344 downloads nothing again when the list and hashes did not change", async () => {
    const server = createServer({ "/api/documents/a": "AAAA" });
    const { kept } = setUp(server);
    await kept.sync([file("/api/documents/a", "AAAA")]);
    server.requested.length = 0;

    const result = await kept.sync([file("/api/documents/a", "AAAA")]);

    expect(server.requested).toEqual([]);
    expect(result).toMatchObject({ kept: [`${ORIGIN}/api/documents/a`], downloaded: [], removed: [], bytesKept: 4 });
  });

  it("MR-344 replaces a copy whose sha256 changed", async () => {
    const server = createServer({ "/api/documents/a": "old" });
    const { kept } = setUp(server);
    await kept.sync([file("/api/documents/a", "old")]);
    server.bodies.set(`${ORIGIN}/api/documents/a`, "new one");

    const result = await kept.sync([file("/api/documents/a", "new one")]);

    expect(result).toMatchObject({ downloaded: [`${ORIGIN}/api/documents/a`], removed: [`${ORIGIN}/api/documents/a`], bytesKept: 7 });
    expect(await (await kept.find("/api/documents/a"))?.text()).toBe("new one");
  });

  it("MR-344 drops a stale copy when its replacement cannot be downloaded", async () => {
    const server = createServer({ "/api/documents/a": "old" });
    const { kept } = setUp(server);
    await kept.sync([file("/api/documents/a", "old")]);
    server.failing.add(`${ORIGIN}/api/documents/a`);

    const result = await kept.sync([file("/api/documents/a", "new one")]);

    expect(result).toMatchObject({ kept: [], removed: [`${ORIGIN}/api/documents/a`], skipped: [{ url: `${ORIGIN}/api/documents/a`, reason: "failed" }] });
    expect(await kept.find("/api/documents/a")).toBeNull();
  });

  it("MR-344 removes the files that left the list", async () => {
    const server = createServer({ "/api/documents/a": "AAAA", "/api/documents/b": "BB" });
    const { kept, storage } = setUp(server);
    await kept.sync([file("/api/documents/a", "AAAA"), file("/api/documents/b", "BB")]);

    const result = await kept.sync([file("/api/documents/b", "BB")]);

    expect(result).toMatchObject({ kept: [`${ORIGIN}/api/documents/b`], removed: [`${ORIGIN}/api/documents/a`], bytesKept: 2 });
    expect(storage.get("trip-documents").getPaths()).toEqual(["/api/documents/b"]);
  });

  it("MR-344 empties the cache for an empty list", async () => {
    const server = createServer({ "/api/documents/a": "AAAA" });
    const { kept } = setUp(server);
    await kept.sync([file("/api/documents/a", "AAAA")]);

    expect(await kept.sync([])).toEqual({ kept: [], bytesKept: 0, downloaded: [], removed: [`${ORIGIN}/api/documents/a`], skipped: [] });
    expect(await kept.getUsage()).toEqual({ files: 0, bytes: 0 });
  });

  it("MR-344 keeps the list's earlier files within the budget and skips the rest, a later small file included when it fits", async () => {
    const server = createServer({ "/a": "1234", "/b": "123456", "/c": "12" });
    const { kept } = setUp(server, 7);

    const result = await kept.sync([file("/a", "1234"), file("/b", "123456"), file("/c", "12")]);

    expect(result).toEqual({
      kept: [`${ORIGIN}/a`, `${ORIGIN}/c`],
      bytesKept: 6,
      downloaded: [`${ORIGIN}/a`, `${ORIGIN}/c`],
      removed: [],
      skipped: [{ url: `${ORIGIN}/b`, reason: "over_budget" }],
    });
    expect(server.requested).toEqual([`${ORIGIN}/a`, `${ORIGIN}/c`]);
  });

  it("MR-344 keeps a file of exactly the budget and nothing with a budget of 0", async () => {
    const server = createServer({ "/a": "1234" });
    expect((await setUp(server, 4).kept.sync([file("/a", "1234")])).bytesKept).toBe(4);
    expect(await setUp(server, 0).kept.sync([file("/a", "1234")])).toMatchObject({ kept: [], skipped: [{ url: `${ORIGIN}/a`, reason: "over_budget" }] });
  });

  it("MR-344 drops a kept file that a reordered list pushes past the budget", async () => {
    const server = createServer({ "/a": "1234", "/b": "12345" });
    const { kept } = setUp(server, 6);
    await kept.sync([file("/a", "1234")]);

    const result = await kept.sync([file("/b", "12345"), file("/a", "1234")]);

    expect(result).toMatchObject({ kept: [`${ORIGIN}/b`], removed: [`${ORIGIN}/a`], skipped: [{ url: `${ORIGIN}/a`, reason: "over_budget" }] });
  });

  it("MR-344 refuses bytes whose hash or size differs from the list", async () => {
    const server = createServer({ "/a": "tampered", "/b": "BB" });
    const { kept } = setUp(server);

    const result = await kept.sync([file("/a", "original"), { ...file("/b", "BB"), bytes: 3 }]);

    expect(result.skipped).toEqual([
      { url: `${ORIGIN}/a`, reason: "checksum_mismatch" },
      { url: `${ORIGIN}/b`, reason: "checksum_mismatch" },
    ]);
    expect(await kept.getUsage()).toEqual({ files: 0, bytes: 0 });
  });

  it("MR-344 reports a 404 and an offline download as failed, and keeps the others", async () => {
    const server = createServer({ "/b": "BB" });
    server.failing.add(`${ORIGIN}/c`);
    const { kept } = setUp(server);

    const result = await kept.sync([file("/a", "AA"), file("/b", "BB"), file("/c", "CC")]);

    expect(result).toMatchObject({
      kept: [`${ORIGIN}/b`],
      skipped: [
        { url: `${ORIGIN}/a`, reason: "failed" },
        { url: `${ORIGIN}/c`, reason: "failed" },
      ],
    });
  });

  it("MR-344 takes a listed URL once and resolves relative and absolute forms to one entry", async () => {
    const server = createServer({ "/a": "AA" });
    const { kept } = setUp(server);

    const result = await kept.sync([file("/a", "AA"), file(`${ORIGIN}/a`, "AA")]);

    expect(result.kept).toEqual([`${ORIGIN}/a`]);
    expect(server.requested).toEqual([`${ORIGIN}/a`]);
  });

  it("MR-344 runs syncs one at a time, in call order", async () => {
    const server = createServer({ "/a": "AA", "/b": "BB" });
    const { kept } = setUp(server);

    const [first, second] = await Promise.all([kept.sync([file("/a", "AA")]), kept.sync([file("/b", "BB")])]);

    expect(first.kept).toEqual([`${ORIGIN}/a`]);
    expect(second).toMatchObject({ kept: [`${ORIGIN}/b`], removed: [`${ORIGIN}/a`] });
  });

  it("MR-344 finds a kept file as a Blob with its type, and null for one not kept", async () => {
    const server = createServer({ "/a": "%PDF-1.7" });
    const { kept } = setUp(server);
    await kept.sync([file("/a", "%PDF-1.7")]);

    const blob = await kept.find("/a");
    expect([await blob?.text(), blob?.type]).toEqual(["%PDF-1.7", "application/pdf"]);
    expect(await kept.find("/b")).toBeNull();
  });

  it("MR-344 refuses a malformed sha256 or size and a bad configuration", async () => {
    const { kept } = setUp(createServer({}));
    await expect(kept.sync([{ url: "/a", sha256: "ABC", bytes: 1 }])).rejects.toThrow("createKeptFiles: sha256 of /a must be 64 lowercase hex characters");
    await expect(kept.sync([{ url: "/a", sha256: sha256("a"), bytes: -1 }])).rejects.toThrow("createKeptFiles: bytes of /a must be a whole number of 0 or more");
    expect(() => createKeptFiles({ app: "Trip", cache: "documents", budgetBytes: 1 })).toThrow('createKeptFiles: app "Trip"');
    expect(() => createKeptFiles({ app: "trip", cache: "pages-docs", budgetBytes: 1 })).toThrow('createKeptFiles: cache "pages-docs"');
    expect(() => createKeptFiles({ app: "trip", cache: "documents", budgetBytes: 1.5 })).toThrow("createKeptFiles: budgetBytes must be a whole number of 0 or more, got 1.5");
  });

  it("MR-344 a refused sync does not block the next one", async () => {
    const server = createServer({ "/a": "AA" });
    const { kept } = setUp(server);
    await expect(kept.sync([{ url: "/a", sha256: "bad", bytes: 1 }])).rejects.toThrow();

    expect((await kept.sync([file("/a", "AA")])).kept).toEqual([`${ORIGIN}/a`]);
  });

  it("MR-344 is cleared on sign-out by clearDeviceData, and no longer after unregister", async () => {
    const server = createServer({ "/a": "AA" });
    const { kept, storage } = setUp(server);
    await kept.sync([file("/a", "AA")]);

    expect(await clearDeviceData({ caches: storage as unknown as CacheStorage, indexedDB: null, storage: null, serviceWorker: null })).toEqual({ failed: [] });
    expect(await storage.has("trip-documents")).toBe(false);

    await kept.sync([file("/a", "AA")]);
    kept.unregister();
    await clearDeviceData({ caches: storage as unknown as CacheStorage, indexedDB: null, storage: null, serviceWorker: null });
    expect(await storage.has("trip-documents")).toBe(true);
  });
});
