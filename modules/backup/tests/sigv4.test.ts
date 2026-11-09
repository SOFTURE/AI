import { describe, expect, it } from "vitest";
import { EMPTY_SHA256, encodeRfc3986, getObjectUrl, signRequest } from "@softure-ai/backup/offsite";

describe("SigV4", () => {
  // The "GET Object" example of AWS's Signature Version 4 documentation for S3 (header-based authentication).
  it("matches AWS's published example signature", () => {
    const headers = signRequest({
      method: "GET",
      url: new URL("https://examplebucket.s3.amazonaws.com/test.txt"),
      headers: { Range: "bytes=0-9" },
      payloadSha256: EMPTY_SHA256,
      region: "us-east-1",
      accessKeyId: "AKIAIOSFODNN7EXAMPLE",
      secretAccessKey: "wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY",
      now: new Date("2013-05-24T00:00:00Z"),
    });
    expect(headers.authorization).toBe(
      "AWS4-HMAC-SHA256 Credential=AKIAIOSFODNN7EXAMPLE/20130524/us-east-1/s3/aws4_request, SignedHeaders=host;range;x-amz-content-sha256;x-amz-date, Signature=f0e8bdb87c964420e857bd35b5d6ed310bd44f0170aba48dd91039c6036bdb41",
    );
    expect(headers["x-amz-date"]).toBe("20130524T000000Z");
    expect(headers).not.toHaveProperty("host");
  });

  it("encodes every byte but the unreserved ones, keeping slashes in a path", () => {
    expect(encodeRfc3986("a b/c~d*\u00e9")).toBe("a%20b%2Fc~d%2A%C3%A9");
    expect(encodeRfc3986("prefix/db.dump.age", true)).toBe("prefix/db.dump.age");
  });

  it("addresses objects path style, under the endpoint's own path", () => {
    const store = {
      endpoint: new URL("https://store.example/base/"),
      region: "auto",
      bucket: "acme-backups",
      prefix: "acme-app",
      accessKeyId: "id",
      secretAccessKey: "secret",
    };
    expect(getObjectUrl(store, "acme-app/db-20261109T031700Z.dump.age").href).toBe("https://store.example/base/acme-backups/acme-app/db-20261109T031700Z.dump.age");
    expect(getObjectUrl(store, null).href).toBe("https://store.example/base/acme-backups");
  });
});
