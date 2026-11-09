// The guarded download against a fake server on loopback: the body streamed to `consume`, redirects checked hop by
// hop, https only on request, the byte cap (declared and streamed), the one time limit and errors of `consume`.
import { once } from "node:events";
import { createServer, request as httpRequest, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import type { AddressInfo } from "node:net";
import { gzipSync } from "node:zlib";
import { downloadGuardedFile, type GuardedDownloadBody, type GuardedRequestSeam } from "@softure-ai/security/server";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

let server: Server;
let port: number;
let received: IncomingMessage[];
let routes: Map<string, (response: ServerResponse) => void>;

beforeEach(async () => {
  received = [];
  routes = new Map();
  server = createServer((request, response) => {
    received.push(request);
    // Matched by comparing paths, never by looking a handler up with the request's URL as the key.
    const route = [...routes].find(([path]) => path === request.url)?.[1];
    if (route === undefined) {
      response.writeHead(404, { "content-type": "text/plain" }).end("missing");
    } else {
      route(response);
    }
  });
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  port = (server.address() as AddressInfo).port;
});

afterEach(async () => {
  server.closeAllConnections();
  server.close();
  await once(server, "close");
});

const loopbackAllowed: GuardedRequestSeam = {
  isAllowedAddress: (address) => address === "127.0.0.1",
  resolveHost: (_hostname, _family, callback) => callback(null, [{ address: "127.0.0.1", family: 4 }]),
};

function file(path: string): string {
  return `http://files.test:${port}${path}`;
}

async function collect(download: GuardedDownloadBody): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of download.body) chunks.push(chunk);
  return Buffer.concat(chunks).toString("utf8");
}

describe("downloadGuardedFile", () => {
  it("streams a 2xx body to consume and returns its value with the head", async () => {
    routes.set("/clip.mp4", (response) => response.writeHead(200, { "content-type": "Video/MP4; codecs=avc1", "content-length": "5" }).end("abcde"));
    const result = await downloadGuardedFile(file("/clip.mp4"), { timeoutMs: 2000, maxBytes: 5, allowedPorts: [port] }, collect, loopbackAllowed);
    expect(result).toEqual({
      ok: true,
      value: { status: 200, finalUrl: file("/clip.mp4"), contentType: "video/mp4", contentLength: 5, consumed: true, value: "abcde" },
    });
    expect(received[0]?.headers).toMatchObject({ accept: "*/*", "user-agent": "Mozilla/5.0 (compatible; softure-ai-security)" });
  });

  it("sends the given accept and user-agent", async () => {
    routes.set("/", (response) => response.writeHead(200).end("x"));
    await downloadGuardedFile(file("/"), { timeoutMs: 2000, maxBytes: 5, allowedPorts: [port], accept: "video/*", userAgent: "Bot/1" }, collect, loopbackAllowed);
    expect(received[0]?.headers).toMatchObject({ accept: "video/*", "user-agent": "Bot/1" });
  });

  it("returns a status that is not 2xx without calling consume", async () => {
    let called = false;
    const result = await downloadGuardedFile(
      file("/gone"),
      { timeoutMs: 2000, maxBytes: 5, allowedPorts: [port] },
      () => {
        called = true;
        return Promise.resolve("never");
      },
      loopbackAllowed,
    );
    expect(result).toEqual({ ok: true, value: { status: 404, finalUrl: file("/gone"), contentType: "text/plain", contentLength: null, consumed: false } });
    expect(called).toBe(false);
  });

  it("reports a missing content-length and content-type as null", async () => {
    routes.set("/a", (response) => {
      response.writeHead(200);
      response.write("ab");
      response.end("c");
    });
    routes.set("/b", (response) => response.writeHead(199 + 1, { "x-length": "1" }).end());
    const a = await downloadGuardedFile(file("/a"), { timeoutMs: 2000, maxBytes: 5, allowedPorts: [port] }, collect, loopbackAllowed);
    expect(a.ok && a.value.contentLength).toBe(null);
    const b = await downloadGuardedFile(file("/b"), { timeoutMs: 2000, maxBytes: 5, allowedPorts: [port] }, collect, loopbackAllowed);
    expect(b.ok && b.value.contentType).toBe(null);
  });

  it("follows a redirect to the file", async () => {
    routes.set("/share", (response) => response.writeHead(302, { location: "/cdn/clip.mp4" }).end());
    routes.set("/cdn/clip.mp4", (response) => response.writeHead(200).end("clip"));
    const result = await downloadGuardedFile(file("/share"), { timeoutMs: 2000, maxBytes: 10, allowedPorts: [port] }, collect, loopbackAllowed);
    expect(result.ok && result.value.consumed && [result.value.finalUrl, result.value.value]).toEqual([file("/cdn/clip.mp4"), "clip"]);
  });

  it("refuses a redirect to a host that is not allowed", async () => {
    routes.set("/share", (response) => response.writeHead(302, { location: `http://127.0.0.2:${String(port)}/x` }).end());
    const result = await downloadGuardedFile(file("/share"), { timeoutMs: 2000, maxBytes: 10, allowedPorts: [port] }, collect, loopbackAllowed);
    expect(result).toEqual({ ok: false, error: "security.outbound_blocked" });
  });

  it("refuses a host that resolves to an address that is not allowed", async () => {
    const result = await downloadGuardedFile(
      file("/"),
      { timeoutMs: 2000, maxBytes: 10, allowedPorts: [port] },
      collect,
      { ...loopbackAllowed, isAllowedAddress: () => false },
    );
    expect(result).toEqual({ ok: false, error: "security.outbound_blocked" });
  });

  it("refuses a plain http URL with requireHttps", async () => {
    const result = await downloadGuardedFile(file("/"), { timeoutMs: 2000, maxBytes: 10, allowedPorts: [port], requireHttps: true }, collect, loopbackAllowed);
    expect(result).toEqual({ ok: false, error: "security.outbound_invalid_url" });
    expect(received).toHaveLength(0);
  });

  it("refuses a redirect to plain http with requireHttps", async () => {
    routes.set("/share", (response) => response.writeHead(302, { location: file("/x") }).end());
    const result = await downloadGuardedFile(
      "https://files.test/share",
      { timeoutMs: 2000, maxBytes: 10, allowedPorts: [443, port], requireHttps: true },
      collect,
      {
        ...loopbackAllowed,
        // The first hop is served plain on loopback; its redirect points to http, which the check refuses.
        request: (_url, options) => httpRequest(new URL(file("/share")), options),
      },
    );
    expect(result).toEqual({ ok: false, error: "security.outbound_invalid_url" });
  });

  it("fails after more redirects than maxRedirects", async () => {
    routes.set("/loop", (response) => response.writeHead(302, { location: "/loop" }).end());
    const result = await downloadGuardedFile(file("/loop"), { timeoutMs: 2000, maxBytes: 10, maxRedirects: 2, allowedPorts: [port] }, collect, loopbackAllowed);
    expect(result).toEqual({ ok: false, error: "security.outbound_failed" });
  });

  it("refuses a declared content-length over maxBytes before consume runs", async () => {
    let called = false;
    routes.set("/", (response) => response.writeHead(200, { "content-length": "11" }).end("0123456789A"));
    const result = await downloadGuardedFile(
      file("/"),
      { timeoutMs: 2000, maxBytes: 10, allowedPorts: [port] },
      () => {
        called = true;
        return Promise.resolve();
      },
      loopbackAllowed,
    );
    expect(result).toEqual({ ok: false, error: "security.outbound_too_large" });
    expect(called).toBe(false);
  });

  it("keeps a body of exactly maxBytes", async () => {
    routes.set("/", (response) => response.writeHead(200).end("0123456789"));
    const result = await downloadGuardedFile(file("/"), { timeoutMs: 2000, maxBytes: 10, allowedPorts: [port] }, collect, loopbackAllowed);
    expect(result.ok && result.value.consumed && result.value.value).toBe("0123456789");
  });

  it("stops a streamed body without a length one byte past maxBytes", async () => {
    routes.set("/", (response) => {
      response.writeHead(200);
      response.write("0123456789");
      response.end("A");
    });
    const result = await downloadGuardedFile(file("/"), { timeoutMs: 2000, maxBytes: 10, allowedPorts: [port] }, collect, loopbackAllowed);
    expect(result).toEqual({ ok: false, error: "security.outbound_too_large" });
  });

  it("caps a compressed body by its decoded size, whatever its declared length", async () => {
    const packed = gzipSync(Buffer.alloc(64, "a"));
    routes.set("/", (response) => response.writeHead(200, { "content-encoding": "gzip", "content-length": String(packed.length) }).end(packed));
    const small = await downloadGuardedFile(file("/"), { timeoutMs: 2000, maxBytes: 10, allowedPorts: [port] }, collect, loopbackAllowed);
    expect(small).toEqual({ ok: false, error: "security.outbound_too_large" });
    const large = await downloadGuardedFile(file("/"), { timeoutMs: 2000, maxBytes: 64, allowedPorts: [port] }, collect, loopbackAllowed);
    expect(large.ok && large.value.consumed && large.value.value).toBe("a".repeat(64));
  });

  it("fails on an encoding it cannot undo", async () => {
    routes.set("/", (response) => response.writeHead(200, { "content-encoding": "zstd" }).end("x"));
    const result = await downloadGuardedFile(file("/"), { timeoutMs: 2000, maxBytes: 10, allowedPorts: [port] }, collect, loopbackAllowed);
    expect(result).toEqual({ ok: false, error: "security.outbound_failed" });
  });

  it("fails on a body that is cut by the server", async () => {
    routes.set("/", (response) => {
      response.writeHead(200, { "content-length": "10" });
      response.write("01234", () => response.destroy());
    });
    const result = await downloadGuardedFile(file("/"), { timeoutMs: 2000, maxBytes: 10, allowedPorts: [port] }, collect, loopbackAllowed);
    expect(result).toEqual({ ok: false, error: "security.outbound_failed" });
  });

  it("times out on a body that stalls, consume included", async () => {
    routes.set("/", (response) => {
      response.writeHead(200);
      response.write("0");
    });
    const result = await downloadGuardedFile(file("/"), { timeoutMs: 100, maxBytes: 10, allowedPorts: [port] }, collect, loopbackAllowed);
    expect(result).toEqual({ ok: false, error: "security.outbound_timeout" });
  });

  it("lets an error of consume itself propagate", async () => {
    routes.set("/", (response) => response.writeHead(200).end("x"));
    await expect(
      downloadGuardedFile(file("/"), { timeoutMs: 2000, maxBytes: 10, allowedPorts: [port] }, () => Promise.reject(new Error("storage down")), loopbackAllowed),
    ).rejects.toThrow("storage down");
  });

  it("fails when the request cannot be sent", async () => {
    const result = await downloadGuardedFile(
      file("/"),
      { timeoutMs: 2000, maxBytes: 10, allowedPorts: [port], userAgent: "bad\nvalue" },
      collect,
      loopbackAllowed,
    );
    expect(result).toEqual({ ok: false, error: "security.outbound_failed" });
  });

  it("refuses invalid limits with a RangeError", async () => {
    await expect(downloadGuardedFile(file("/"), { timeoutMs: 2000, maxBytes: 0 }, collect)).rejects.toThrow(RangeError);
    await expect(downloadGuardedFile(file("/"), { timeoutMs: 2000, maxBytes: 1, maxRedirects: -1 }, collect)).rejects.toThrow(RangeError);
    await expect(downloadGuardedFile(file("/"), { timeoutMs: 0, maxBytes: 1 }, collect)).rejects.toThrow(RangeError);
  });

  it("guards public addresses by default", async () => {
    const result = await downloadGuardedFile(`http://127.0.0.1:${String(port)}/`, { timeoutMs: 2000, maxBytes: 10, allowedPorts: [port] }, collect);
    expect(result).toEqual({ ok: false, error: "security.outbound_blocked" });
  });
});
