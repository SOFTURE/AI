// The fake S3 bucket against the module's own S3 driver and SigV4 signer: what an app's tests rely on when they hand
// `createFakeS3().fetch` to `createS3Storage` or to their own S3 client.
import { createS3Storage, signRequest } from "@softure-ai/files/server";
import { createFakeS3 } from "@softure-ai/files/testing";
import { describe, expect, it } from "vitest";

const KEYS = { accessKeyId: "AKIAFAKESTORE0001", secretAccessKey: "fake-store-secret-not-for-production" };
const ENV = { STORE_KEY_ID: KEYS.accessKeyId, STORE_SECRET: KEYS.secretAccessKey };
const EMPTY_SHA256 = "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855";

function setUp(isWritable: boolean) {
  const s3 = createFakeS3({ bucket: "notes-store", basePath: "/store", isWritable, ...KEYS });
  const storage = createS3Storage({
    endpoint: "http://127.0.0.1:3199/store",
    bucket: "notes-store",
    region: "auto",
    accessKeyIdEnv: "STORE_KEY_ID",
    secretAccessKeyEnv: "STORE_SECRET",
    env: ENV,
    fetch: s3.fetch,
  });
  return { s3, storage };
}

async function readAll(stream: ReadableStream<Uint8Array> | null): Promise<string> {
  return stream === null ? "<missing>" : new Response(stream).text();
}

function bodyOf(text: string): ReadableStream<Uint8Array> {
  return new Blob([text]).stream();
}

/** A ListObjectsV2 request signed with `secretAccessKey`. */
async function list(s3: ReturnType<typeof createFakeS3>, query: string, secretAccessKey = KEYS.secretAccessKey): Promise<Response> {
  const url = new URL(`http://127.0.0.1:3199/store/notes-store?${query}`);
  const headers = signRequest({
    method: "GET",
    url,
    headers: {},
    payloadSha256: EMPTY_SHA256,
    region: "auto",
    credentials: { accessKeyId: KEYS.accessKeyId, secretAccessKey },
    date: new Date("2026-11-18T10:00:00Z"),
  });
  return s3.fetch(url, { headers });
}

describe("createFakeS3, writable", () => {
  it("stores, reads (whole and by range), sizes and deletes an object signed with its key pair", async () => {
    const { s3, storage } = setUp(true);

    await storage.put(bodyOf("# Garden\nRaised beds.\n"), "copies/a.md");

    expect(await readAll(await storage.get("copies/a.md"))).toBe("# Garden\nRaised beds.\n");
    expect(await readAll(await storage.get("copies/a.md", { start: 2, end: 7 }))).toBe("Garden");
    expect(await storage.head("copies/a.md")).toEqual({ size: 22 });
    await storage.delete("copies/a.md");
    expect(await storage.head("copies/a.md")).toBeNull();
    expect(await storage.get("copies/a.md")).toBeNull();
    expect(s3.calls).toMatchObject({ put: 1, get: 3, head: 2, delete: 1 });
  });

  it("passes the driver's health probe", async () => {
    const { storage } = setUp(true);

    expect(await storage.check?.()).toEqual({ isWritable: true, freeBytes: null });
  });
});

describe("createFakeS3, read-only", () => {
  it("refuses writes", async () => {
    const { storage } = setUp(false);

    await expect(storage.put(bodyOf("x"), "copies/a.md")).rejects.toThrow();
  });

  it("lists the keys under a prefix in pages, with continuation tokens", async () => {
    const { s3 } = setUp(false);
    for (const key of ["vault/a.md", "vault/b.md", "vault/c.md", "other/d.md"]) s3.put(key, key);

    const first = await (await list(s3, "list-type=2&prefix=vault%2F&max-keys=2")).text();
    expect(first).toContain("<Key>vault/a.md</Key>");
    expect(first).toContain("<Key>vault/b.md</Key>");
    expect(first).toContain("<IsTruncated>true</IsTruncated><");
    expect(first).toContain("<NextContinuationToken>2</NextContinuationToken>");
    const second = await (await list(s3, "list-type=2&prefix=vault%2F&max-keys=2&continuation-token=2")).text();
    expect(second).toContain("<KeyCount>1</KeyCount>");
    expect(second).toContain("<Key>vault/c.md</Key>");
    expect(second).not.toContain("other/d.md");
  });

  it("answers 403 to a request signed with another secret and counts nothing", async () => {
    const { s3 } = setUp(false);

    expect((await list(s3, "list-type=2", "a-different-secret")).status).toBe(403);
    expect(s3.calls.list).toBe(0);
  });

  it("answers an injected status until it is cleared", async () => {
    const { s3 } = setUp(false);
    s3.fail("list", 503);

    expect((await list(s3, "list-type=2")).status).toBe(503);
    s3.fail("list", null);
    expect((await list(s3, "list-type=2")).status).toBe(200);
  });
});
