// The S3-compatible driver against a fake S3 (an in-memory `fetch`), and its SigV4 signer against the test vector
// AWS publishes for S3 (GET object with a range, "Signature Calculations for the Authorization Header").
import { createS3Storage, signRequest, splitIntoParts, type S3StorageOptions } from "@softure-ai/files/server";
import { describe, expect, it } from "vitest";
import { chunked, readText } from "./support.js";

const MIB = 1024 * 1024;

describe("signRequest", () => {
  it("matches the AWS test vector for a ranged GET", () => {
    const headers = signRequest({
      method: "GET",
      url: new URL("https://examplebucket.s3.amazonaws.com/test.txt"),
      headers: { Range: "bytes=0-9" },
      payloadSha256: "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
      region: "us-east-1",
      credentials: {
        accessKeyId: "AKIAIOSFODNN7EXAMPLE",
        secretAccessKey: "wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY",
      },
      date: new Date("2013-05-24T00:00:00Z"),
    });

    expect(headers.authorization).toBe(
      "AWS4-HMAC-SHA256 Credential=AKIAIOSFODNN7EXAMPLE/20130524/us-east-1/s3/aws4_request, SignedHeaders=host;range;x-amz-content-sha256;x-amz-date, Signature=f0e8bdb87c964420e857bd35b5d6ed310bd44f0170aba48dd91039c6036bdb41",
    );
  });
});

interface FakeS3 {
  readonly fetch: NonNullable<S3StorageOptions["fetch"]>;
  readonly objects: Map<string, Buffer>;
  readonly calls: string[];
  readonly uploads: Map<string, Map<number, Buffer>>;
  failOn?: string;
}

/** A path-style S3 with PutObject, GetObject (ranges), HeadObject, DeleteObject and multipart uploads. */
function createFakeS3(): FakeS3 {
  const fake: FakeS3 = {
    objects: new Map(),
    calls: [],
    uploads: new Map(),
    fetch: (input, init) => Promise.resolve(answer(input, init)),
  };
  function answer(input: string | URL, init: RequestInit): Response {
    const url = new URL(input);
    const method = init.method ?? "GET";
    const headers = new Headers(init.headers);
    const authorization = headers.get("authorization") ?? "";
    const key = decodeURIComponent(url.pathname.replace(/^\/bucket\//, ""));
    const body = init.body === undefined || init.body === null ? Buffer.alloc(0) : Buffer.from(init.body as Uint8Array);
    const operation = `${method} ${key}${url.search === "" ? "" : ` ${[...url.searchParams.keys()].join(",")}`}`;
    fake.calls.push(operation);
    if (!authorization.startsWith("AWS4-HMAC-SHA256 Credential=key-id/") || headers.get("x-amz-content-sha256") === null) {
      return new Response("<Error><Code>AccessDenied</Code></Error>", {
        status: 403,
      });
    }
    if (fake.failOn !== undefined && operation.startsWith(fake.failOn)) return new Response("<Error/>", { status: 500 });
    const uploadId = url.searchParams.get("uploadId");
    if (method === "POST" && url.searchParams.has("uploads")) {
      const id = `upload-${String(fake.uploads.size + 1)}`;
      fake.uploads.set(id, new Map());
      return new Response(`<InitiateMultipartUploadResult><UploadId>${id}</UploadId></InitiateMultipartUploadResult>`);
    }
    if (method === "PUT" && uploadId !== null) {
      fake.uploads.get(uploadId)?.set(Number(url.searchParams.get("partNumber")), body);
      return new Response(null, {
        headers: { etag: `"etag-${url.searchParams.get("partNumber") ?? ""}"` },
      });
    }
    if (method === "POST" && uploadId !== null) {
      const parts = fake.uploads.get(uploadId);
      const listed = [...body.toString().matchAll(/<PartNumber>(\d+)<\/PartNumber><ETag>&quot;etag-(\d+)&quot;<\/ETag>/g)].map((match) =>
        Number(match[1]),
      );
      fake.objects.set(key, Buffer.concat(listed.map((number) => parts?.get(number) ?? Buffer.alloc(0))));
      fake.uploads.delete(uploadId);
      return new Response("<CompleteMultipartUploadResult/>");
    }
    if (method === "DELETE" && uploadId !== null) {
      fake.uploads.delete(uploadId);
      return new Response(null, { status: 204 });
    }
    const stored = fake.objects.get(key);
    switch (method) {
      case "PUT":
        fake.objects.set(key, body);
        return new Response(null, { headers: { etag: '"x"' } });
      case "GET": {
        if (stored === undefined)
          return new Response("<Error><Code>NoSuchKey</Code></Error>", {
            status: 404,
          });
        const range = /^bytes=(\d+)-(\d+)$/.exec(headers.get("range") ?? "");
        if (range === null) return new Response(new Uint8Array(stored));
        return new Response(new Uint8Array(stored.subarray(Number(range[1]), Number(range[2]) + 1)), { status: 206 });
      }
      case "HEAD":
        return stored === undefined
          ? new Response(null, { status: 404 })
          : new Response(null, {
              headers: { "content-length": String(stored.length) },
            });
      case "DELETE":
        fake.objects.delete(key);
        return new Response(null, { status: 204 });
      default:
        return new Response(null, { status: 405 });
    }
  }
  return fake;
}

function createStorage(fake: FakeS3, options: Partial<S3StorageOptions> = {}) {
  return createS3Storage({
    endpoint: "https://s3.example.com",
    bucket: "bucket",
    region: "auto",
    fetch: fake.fetch,
    env: {
      SOFTURE_FILES_S3_ACCESS_KEY_ID: "key-id",
      SOFTURE_FILES_S3_SECRET_ACCESS_KEY: "secret",
    },
    partSizeBytes: 5 * MIB,
    ...options,
  });
}

describe("the S3 storage driver", () => {
  it("puts a small body in one request, then reads, ranges, sizes and deletes it", async () => {
    const fake = createFakeS3();
    const storage = createStorage(fake, { prefix: "app/" });

    await storage.put(chunked("0123456789"), "ab/cd/one");

    expect(fake.calls).toEqual(["PUT app/ab/cd/one"]);
    expect(await readText((await storage.get("ab/cd/one")) as ReadableStream<Uint8Array>)).toBe("0123456789");
    expect(
      await readText(
        (await storage.get("ab/cd/one", {
          start: 2,
          end: 4,
        })) as ReadableStream<Uint8Array>,
      ),
    ).toBe("234");
    expect(await storage.head("ab/cd/one")).toEqual({ size: 10 });
    await storage.delete("ab/cd/one");
    expect(await storage.get("ab/cd/one")).toBeNull();
    expect(await storage.head("ab/cd/one")).toBeNull();
  });

  it("puts a long body as a multipart upload, one part in memory at a time", async () => {
    const fake = createFakeS3();
    const storage = createStorage(fake);
    const content = Buffer.alloc(11 * MIB + 3, 7);
    content.write("start", 0);
    content.write("end", content.length - 3);

    await storage.put(chunked(content, 256 * 1024), "ab/cd/big");

    expect(fake.calls).toEqual([
      "POST ab/cd/big uploads",
      "PUT ab/cd/big partNumber,uploadId",
      "PUT ab/cd/big partNumber,uploadId",
      "PUT ab/cd/big partNumber,uploadId",
      "POST ab/cd/big uploadId",
    ]);
    expect(fake.objects.get("ab/cd/big")?.equals(content)).toBe(true);
    expect(fake.uploads.size).toBe(0);
  });

  it("aborts the multipart upload when a part fails, leaving no object", async () => {
    const fake = createFakeS3();
    const storage = createStorage(fake);
    fake.failOn = "PUT ab/cd/big partNumber";

    await expect(storage.put(chunked(Buffer.alloc(6 * MIB), MIB), "ab/cd/big")).rejects.toThrow(/UploadPart answered 500/);
    expect(fake.calls.at(-1)).toBe("DELETE ab/cd/big uploadId");
    expect(fake.uploads.size).toBe(0);
    expect(fake.objects.size).toBe(0);
  });

  it("aborts the multipart upload when the body fails, and lets the error through", async () => {
    const fake = createFakeS3();
    const storage = createStorage(fake);
    async function* broken(): AsyncGenerator<Uint8Array> {
      yield* chunked(Buffer.alloc(11 * MIB), MIB);
      throw new Error("body failed");
    }

    await expect(storage.put(broken(), "ab/cd/big")).rejects.toThrow("body failed");
    expect(fake.uploads.size).toBe(0);
    expect(fake.objects.size).toBe(0);
  });

  it("puts an empty body as an empty object", async () => {
    const fake = createFakeS3();
    await createStorage(fake).put(chunked(""), "ab/cd/empty");
    expect(fake.objects.get("ab/cd/empty")?.length).toBe(0);
  });

  it("throws a status-only error for an unexpected answer, never the URL", async () => {
    const fake = createFakeS3();
    const storage = createStorage(fake);
    fake.failOn = "GET";
    await storage.put(chunked("x"), "ab/cd/one");

    const failure = storage.get("ab/cd/one");
    await expect(failure).rejects.toThrow("@softure-ai/files: S3 GetObject answered 500");
  });

  it("needs its access keys only when it sends a request", async () => {
    const fake = createFakeS3();
    const storage = createStorage(fake, { env: {} });
    await expect(storage.head("ab/cd/one")).rejects.toThrow(/SOFTURE_FILES_S3_ACCESS_KEY_ID and SOFTURE_FILES_S3_SECRET_ACCESS_KEY/);
    expect(fake.calls).toEqual([]);
  });

  it("probes the bucket with a write and a delete for the health check", async () => {
    const fake = createFakeS3();
    expect(await createStorage(fake).check?.()).toEqual({
      isWritable: true,
      freeBytes: null,
    });
    expect(fake.objects.size).toBe(0);
    fake.failOn = "PUT";
    expect(await createStorage(fake).check?.()).toEqual({
      isWritable: false,
      freeBytes: null,
    });
  });

  it.each([
    ["an http endpoint off localhost", { endpoint: "http://s3.example.com" }],
    ["a malformed endpoint", { endpoint: "not a url" }],
    ["a bucket with uppercase", { bucket: "Bucket" }],
    ["a prefix without a trailing slash", { prefix: "files" }],
    ["parts under 5 MiB", { partSizeBytes: MIB }],
  ])("refuses %s when built", (_label, options) => {
    expect(() => createStorage(createFakeS3(), options)).toThrow(RangeError);
  });

  it("allows http on localhost, for MinIO in development", () => {
    expect(() => createStorage(createFakeS3(), { endpoint: "http://localhost:9000" })).not.toThrow();
  });
});

describe("splitIntoParts", () => {
  it("re-cuts chunks into parts of exactly the size, the last one shorter", async () => {
    const parts: number[] = [];
    for await (const part of splitIntoParts(chunked("abcdefghij", 3), 4)) parts.push(part.length);
    expect(parts).toEqual([4, 4, 2]);
  });

  it("yields nothing for an empty body", async () => {
    const parts: Buffer[] = [];
    for await (const part of splitIntoParts(chunked(""), 4)) parts.push(part);
    expect(parts).toEqual([]);
  });
});
