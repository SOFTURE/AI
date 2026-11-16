// saveFileFromUrl (MR-344 of an adopting app's booking documents): an https URL downloaded through the guarded download
// into saveFile, against a fake server on loopback. The seam sends each https request to that server, so the guard's
// https-only rule, port rule and address check run exactly as in production.
import { once } from "node:events";
import { createServer, request as httpRequest, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import type { AddressInfo } from "node:net";
import { gzipSync } from "node:zlib";
import { findFile, openFile, SAVE_FROM_URL_DEFAULT_NAME, saveFile, saveFileFromUrl } from "@softure-ai/files/server";
import type { GuardedRequestSeam } from "@softure-ai/security/server";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { ALICE, chunked, closeTestFiles, createTestFiles, listRows, NOW, readText, sha256, type TestFiles } from "./support.js";

let server: Server;
let port: number;
let received: IncomingMessage[];
let routes: Map<string, (response: ServerResponse) => void>;
let test: TestFiles;

beforeEach(async () => {
  received = [];
  routes = new Map();
  server = createServer((request, response) => {
    received.push(request);
    const route = [...routes].find(([path]) => path === request.url)?.[1];
    if (route === undefined) response.writeHead(404, { "content-type": "text/plain" }).end("missing");
    else route(response);
  });
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  port = (server.address() as AddressInfo).port;
});

afterEach(async () => {
  server.closeAllConnections();
  server.close();
  await once(server, "close");
  await closeTestFiles();
});

/** Resolves every host to loopback, allows loopback, and carries each https request to the fake server over http. */
const toFakeServer: GuardedRequestSeam = {
  isAllowedAddress: (address) => address === "127.0.0.1",
  resolveHost: (_hostname, _family, callback) => callback(null, [{ address: "127.0.0.1", family: 4 }]),
  request: (url, options) => httpRequest(new URL(`http://docs.test:${port}${url.pathname}${url.search}`), options),
};

const PDF = "%PDF-1.7 fictional booking confirmation";

function servePdf(path: string, body: string | Buffer = PDF, headers: Record<string, string> = { "content-type": "application/pdf" }): void {
  routes.set(path, (response) => response.writeHead(200, headers).end(body));
}

describe("saveFileFromUrl (MR-344)", () => {
  it("MR-344 saves an https file with the name from the URL, the answered type and its hash", async () => {
    test = await createTestFiles();
    servePdf("/confirmations/Booking%20A.pdf");

    const saved = await saveFileFromUrl(test.ctx, { ownerId: ALICE, url: "https://docs.example.com/confirmations/Booking%20A.pdf", kind: "document" }, toFakeServer);

    expect(saved).toEqual({
      ok: true,
      value: {
        id: expect.stringMatching(/^[0-9a-f-]{36}$/) as unknown,
        ownerId: ALICE,
        sha256: sha256(PDF),
        size: Buffer.byteLength(PDF),
        contentType: "application/pdf",
        name: "Booking A.pdf",
        kind: "document",
        expiresAt: null,
        createdAt: NOW,
      },
    });
    if (!saved.ok) return;
    const opened = await openFile(test.ctx, saved.value.id);
    expect(opened.ok && (await readText(opened.value.body))).toBe(PDF);
    expect(received[0]?.headers.accept).toBe("*/*");
  });

  it("MR-344 takes the given name and type over the answer's, and decodes a gzip body before counting it", async () => {
    test = await createTestFiles();
    servePdf("/x", gzipSync(PDF), { "content-type": "application/octet-stream", "content-encoding": "gzip" });

    const saved = await saveFileFromUrl(
      test.ctx,
      { ownerId: ALICE, url: "https://docs.example.com/x", name: "ticket.pdf", contentType: "application/pdf", ttlSeconds: 3600 },
      toFakeServer,
    );

    expect(saved.ok && [saved.value.name, saved.value.contentType, saved.value.size, saved.value.expiresAt]).toEqual([
      "ticket.pdf",
      "application/pdf",
      Buffer.byteLength(PDF),
      new Date(NOW.getTime() + 3600 * 1000),
    ]);
  });

  it("MR-344 names a file whose URL ends in a slash 'download' and stores octet-stream when the server sends no type", async () => {
    test = await createTestFiles();
    routes.set("/folder/", (response) => response.writeHead(200).end("bytes"));

    const saved = await saveFileFromUrl(test.ctx, { ownerId: ALICE, url: "https://docs.example.com/folder/" }, toFakeServer);

    expect(saved.ok && [saved.value.name, saved.value.contentType]).toEqual([SAVE_FROM_URL_DEFAULT_NAME, "application/octet-stream"]);
  });

  it("MR-344 follows an https redirect to the file", async () => {
    test = await createTestFiles();
    routes.set("/short", (response) => response.writeHead(302, { location: "https://cdn.example.com/files/voucher.pdf" }).end());
    servePdf("/files/voucher.pdf");

    const saved = await saveFileFromUrl(test.ctx, { ownerId: ALICE, url: "https://docs.example.com/short" }, toFakeServer);

    expect(saved.ok && saved.value.name).toBe("voucher.pdf");
  });

  it("MR-344 accepts a type matched by a wildcard rule and sends the rules as accept", async () => {
    test = await createTestFiles();
    servePdf("/photo.jpg", "jpeg", { "content-type": "image/jpeg" });

    const saved = await saveFileFromUrl(test.ctx, { ownerId: ALICE, url: "https://docs.example.com/photo.jpg", contentTypes: ["application/pdf", "image/*"] }, toFakeServer);

    expect(saved.ok && saved.value.contentType).toBe("image/jpeg");
    expect(received[0]?.headers.accept).toBe("application/pdf, image/*");
  });
});

describe("saveFileFromUrl refusals (MR-344)", () => {
  it("MR-344 refuses an answered type outside contentTypes and keeps nothing", async () => {
    test = await createTestFiles();
    servePdf("/page", "<html></html>", { "content-type": "text/html; charset=utf-8" });

    const saved = await saveFileFromUrl(test.ctx, { ownerId: ALICE, url: "https://docs.example.com/page", contentTypes: ["application/pdf", "image/*"] }, toFakeServer);

    expect(saved).toEqual({ ok: false, error: "files.content_type_not_allowed" });
    expect(await listRows(test.database)).toEqual([]);
    expect(test.storage.objects().size).toBe(0);
  });

  it("MR-344 refuses a given type outside contentTypes before any request", async () => {
    test = await createTestFiles();

    const saved = await saveFileFromUrl(
      test.ctx,
      { ownerId: ALICE, url: "https://docs.example.com/a", contentType: "text/html", contentTypes: ["application/pdf"] },
      toFakeServer,
    );

    expect(saved).toEqual({ ok: false, error: "files.content_type_not_allowed" });
    expect(received).toEqual([]);
  });

  it("MR-344 refuses a plain http URL, another port and a malformed URL without a request", async () => {
    test = await createTestFiles();

    for (const url of ["http://docs.example.com/a.pdf", "https://docs.example.com:8443/a.pdf", "not a url", "ftp://docs.example.com/a.pdf"]) {
      expect(await saveFileFromUrl(test.ctx, { ownerId: ALICE, url }, toFakeServer)).toEqual({ ok: false, error: "files.url_not_allowed" });
    }
    expect(received).toEqual([]);
  });

  it("MR-344 refuses a redirect to plain http", async () => {
    test = await createTestFiles();
    routes.set("/short", (response) => response.writeHead(302, { location: "http://docs.example.com/a.pdf" }).end());

    expect(await saveFileFromUrl(test.ctx, { ownerId: ALICE, url: "https://docs.example.com/short" }, toFakeServer)).toEqual({ ok: false, error: "files.url_not_allowed" });
    expect(received).toHaveLength(1);
  });

  it("MR-344 refuses a host that resolves to a private or loopback address (SSRF)", async () => {
    test = await createTestFiles();
    servePdf("/a.pdf");

    for (const address of ["127.0.0.1", "10.0.0.5", "169.254.169.254", "192.168.1.1"]) {
      const seam: GuardedRequestSeam = { ...toFakeServer, isAllowedAddress: undefined, resolveHost: (_h, _f, callback) => callback(null, [{ address, family: 4 }]) };
      expect(await saveFileFromUrl(test.ctx, { ownerId: ALICE, url: "https://internal.example.com/a.pdf" }, seam)).toEqual({ ok: false, error: "files.url_blocked" });
    }
    expect(received).toEqual([]);
    expect(await listRows(test.database)).toEqual([]);
  });

  it("MR-344 refuses an IP literal of the metadata service", async () => {
    test = await createTestFiles();
    const saved = await saveFileFromUrl(test.ctx, { ownerId: ALICE, url: "https://169.254.169.254/latest/meta-data" }, { request: toFakeServer.request });
    expect(saved).toEqual({ ok: false, error: "files.url_blocked" });
    expect(received).toEqual([]);
  });

  it("MR-344 answers download_failed for a 404 and keeps nothing", async () => {
    test = await createTestFiles();

    expect(await saveFileFromUrl(test.ctx, { ownerId: ALICE, url: "https://docs.example.com/gone.pdf" }, toFakeServer)).toEqual({ ok: false, error: "files.download_failed" });
    expect(await listRows(test.database)).toEqual([]);
  });

  it("MR-344 refuses a declared length over maxFileBytes before reading the body", async () => {
    test = await createTestFiles({ files: { maxFileBytes: 10 } });
    servePdf("/big.pdf", "x".repeat(11), { "content-type": "application/pdf", "content-length": "11" });

    expect(await saveFileFromUrl(test.ctx, { ownerId: ALICE, url: "https://docs.example.com/big.pdf" }, toFakeServer)).toEqual({ ok: false, error: "files.too_large" });
    expect(test.storage.objects().size).toBe(0);
  });

  it("MR-344 refuses a streamed body one byte over maxFileBytes and keeps none of it", async () => {
    test = await createTestFiles({ files: { maxFileBytes: 10 } });
    routes.set("/stream.pdf", (response) => {
      response.writeHead(200, { "content-type": "application/pdf" });
      response.write("x".repeat(6));
      response.end("y".repeat(5));
    });

    expect(await saveFileFromUrl(test.ctx, { ownerId: ALICE, url: "https://docs.example.com/stream.pdf" }, toFakeServer)).toEqual({ ok: false, error: "files.too_large" });
    expect(test.storage.objects().size).toBe(0);
    expect(await listRows(test.database)).toEqual([]);
  });

  it("MR-344 keeps a body of exactly maxFileBytes", async () => {
    test = await createTestFiles({ files: { maxFileBytes: 10 } });
    servePdf("/edge.pdf", "x".repeat(10));

    const saved = await saveFileFromUrl(test.ctx, { ownerId: ALICE, url: "https://docs.example.com/edge.pdf" }, toFakeServer);
    expect(saved.ok && saved.value.size).toBe(10);
  });

  it("MR-344 answers quota_exceeded when the file would pass the owner's quota", async () => {
    test = await createTestFiles({ files: { quotaBytesPerOwner: 20 } });
    await saveFile(test.ctx, { ownerId: ALICE, body: chunked("x".repeat(15)), name: "first" });
    servePdf("/second.pdf", "y".repeat(10));

    expect(await saveFileFromUrl(test.ctx, { ownerId: ALICE, url: "https://docs.example.com/second.pdf" }, toFakeServer)).toEqual({ ok: false, error: "files.quota_exceeded" });
    expect(await listRows(test.database)).toHaveLength(1);
  });

  it("MR-344 answers download_timeout for a server that never finishes", async () => {
    test = await createTestFiles();
    routes.set("/slow.pdf", (response) => {
      response.writeHead(200, { "content-type": "application/pdf" });
      response.write("part");
    });

    expect(await saveFileFromUrl(test.ctx, { ownerId: ALICE, url: "https://docs.example.com/slow.pdf", timeoutMs: 150 }, toFakeServer)).toEqual({
      ok: false,
      error: "files.download_timeout",
    });
    expect(test.storage.objects().size).toBe(0);
  });

  it("MR-344 answers download_failed for a connection reset mid-body", async () => {
    test = await createTestFiles();
    routes.set("/reset.pdf", (response) => {
      response.writeHead(200, { "content-type": "application/pdf", "content-length": "100" });
      response.write("part", () => response.socket?.destroy());
    });

    expect(await saveFileFromUrl(test.ctx, { ownerId: ALICE, url: "https://docs.example.com/reset.pdf" }, toFakeServer)).toEqual({ ok: false, error: "files.download_failed" });
    expect(await listRows(test.database)).toEqual([]);
  });

  it("MR-344 refuses an invalid owner, kind or time limit before any request", async () => {
    test = await createTestFiles();
    const url = "https://docs.example.com/a.pdf";

    expect(await saveFileFromUrl(test.ctx, { ownerId: "", url }, toFakeServer)).toEqual({ ok: false, error: "files.invalid_input" });
    expect(await saveFileFromUrl(test.ctx, { ownerId: ALICE, url, kind: "Bad Kind" }, toFakeServer)).toEqual({ ok: false, error: "files.invalid_input" });
    expect(await saveFileFromUrl(test.ctx, { ownerId: ALICE, url, timeoutMs: 0 }, toFakeServer)).toEqual({ ok: false, error: "files.invalid_input" });
    expect(received).toEqual([]);
  });

  it("MR-344 propagates a storage failure, as saveFile does", async () => {
    test = await createTestFiles();
    servePdf("/a.pdf");
    test.storage.setFailing(true);

    await expect(saveFileFromUrl(test.ctx, { ownerId: ALICE, url: "https://docs.example.com/a.pdf" }, toFakeServer)).rejects.toThrow("memory storage: put failed");
    expect(await listRows(test.database)).toEqual([]);
  });

  it("MR-344 answers an existing file for the same content when dedupe is on", async () => {
    test = await createTestFiles({ files: { dedupe: true } });
    servePdf("/a.pdf");
    const first = await saveFileFromUrl(test.ctx, { ownerId: ALICE, url: "https://docs.example.com/a.pdf" }, toFakeServer);
    const second = await saveFileFromUrl(test.ctx, { ownerId: ALICE, url: "https://docs.example.com/a.pdf" }, toFakeServer);

    expect(first.ok && second.ok && second.value.id === first.value.id).toBe(true);
    expect(first.ok && (await findFile(test.ctx, first.value.id))?.id).toBe(first.ok ? first.value.id : null);
    expect(test.storage.objects().size).toBe(1);
  });
});
