// The SSRF-guarded request against a fake server on loopback: what reaches it, what is refused before a
// connection, and what the guarded lookup does with the addresses a host name resolves to.
import { once } from "node:events";
import { createServer, request as requestHttp, type ClientRequest, type IncomingMessage, type RequestOptions, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { sendGuardedRequest, type GuardedRequestSeam, type ResolveHost } from "@softure-ai/security/server";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

interface Received {
  readonly method: string | undefined;
  readonly headers: IncomingMessage["headers"];
  readonly body: string;
}

let server: Server;
let port: number;
let received: Received[];
let respond: (response: import("node:http").ServerResponse) => void;

beforeEach(async () => {
  received = [];
  respond = (response) => response.writeHead(204).end();
  server = createServer((request, response) => {
    const chunks: Buffer[] = [];
    request.on("data", (chunk: Buffer) => chunks.push(chunk));
    request.on("end", () => {
      received.push({ method: request.method, headers: request.headers, body: Buffer.concat(chunks).toString("utf8") });
      respond(response);
    });
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

const loopbackAllowed: GuardedRequestSeam = { isAllowedAddress: (address) => address === "127.0.0.1" };

// `net.connect` reads `autoSelectFamily` from the request options; @types/node leaves it out of RequestOptions.
function requestWithFamilySelection(autoSelectFamily: boolean): (url: URL, options: RequestOptions) => ClientRequest {
  return (url, options) => {
    const withFamily: RequestOptions & { readonly autoSelectFamily: boolean } = { ...options, autoSelectFamily };
    return requestHttp(url, withFamily);
  };
}

function resolvesTo(...addresses: string[]): ResolveHost {
  return (_hostname, _family, callback) => {
    callback(
      null,
      addresses.map((address) => ({ address, family: address.includes(":") ? 6 : 4 })),
    );
  };
}

describe("sendGuardedRequest", () => {
  it("posts the body and headers and returns the status", async () => {
    const result = await sendGuardedRequest(
      `http://127.0.0.1:${port}/unsubscribe?u=1`,
      { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" }, body: "List-Unsubscribe=One-Click", timeoutMs: 2000, allowedPorts: [port] },
      loopbackAllowed,
    );
    expect(result).toEqual({ ok: true, value: { status: 204 } });
    expect(received).toHaveLength(1);
    expect(received[0]?.method).toBe("POST");
    expect(received[0]?.body).toBe("List-Unsubscribe=One-Click");
    expect(received[0]?.headers["content-type"]).toBe("application/x-www-form-urlencoded");
    expect(received[0]?.headers["content-length"]).toBe("26");
  });

  it("returns a redirect as its status without following it", async () => {
    respond = (response) => response.writeHead(302, { location: "http://169.254.169.254/latest/meta-data" }).end();
    const result = await sendGuardedRequest(`http://127.0.0.1:${port}/`, { method: "GET", timeoutMs: 2000, allowedPorts: [port] }, loopbackAllowed);
    expect(result).toEqual({ ok: true, value: { status: 302 } });
    expect(received).toHaveLength(1);
  });

  it("returns the status without waiting for a body that never ends", async () => {
    respond = (response) => {
      response.writeHead(200, { "content-type": "text/plain" });
      response.write("x".repeat(1024));
    };
    const result = await sendGuardedRequest(`http://127.0.0.1:${port}/`, { method: "GET", timeoutMs: 2000, allowedPorts: [port] }, loopbackAllowed);
    expect(result).toEqual({ ok: true, value: { status: 200 } });
  });

  it("times out when no status arrives in time", async () => {
    respond = () => undefined;
    const result = await sendGuardedRequest(`http://127.0.0.1:${port}/`, { method: "GET", timeoutMs: 100, allowedPorts: [port] }, loopbackAllowed);
    expect(result).toEqual({ ok: false, error: "security.outbound_timeout" });
  });

  it("refuses a loopback literal with the default address rule, before connecting", async () => {
    const result = await sendGuardedRequest(`http://127.0.0.1:${port}/`, { method: "GET", timeoutMs: 2000, allowedPorts: [port] });
    expect(result).toEqual({ ok: false, error: "security.outbound_blocked" });
    expect(received).toHaveLength(0);
  });

  it.each([
    "https://[::1]/",
    "https://[::ffff:127.0.0.1]/",
    "https://0x7f.1/",
    "https://2130706433/",
    "https://169.254.169.254/",
    "https://[fd00::1]/",
  ])("refuses the non-public literal %s", async (url) => {
    expect(await sendGuardedRequest(url, { method: "GET", timeoutMs: 2000 })).toEqual({
      ok: false,
      error: "security.outbound_blocked",
    });
  });

  it.each([
    ["a malformed URL", "not a url"],
    ["another scheme", "ftp://example.com/"],
    ["a file URL", "file:///etc/passwd"],
    ["credentials", "https://user:secret@example.com/"],
  ])("refuses %s as an invalid URL", async (_label, url) => {
    expect(await sendGuardedRequest(url, { method: "GET", timeoutMs: 2000 })).toEqual({
      ok: false,
      error: "security.outbound_invalid_url",
    });
  });

  it.each(["https://example.com:8443/", "http://example.com/", "https://example.com:22/"])(
    "refuses %s on a port outside the default [443]",
    async (url) => {
      expect(await sendGuardedRequest(url, { method: "GET", timeoutMs: 2000 })).toEqual({
        ok: false,
        error: "security.outbound_blocked",
      });
    },
  );

  it("connects to a host name whose every address is allowed", async () => {
    const result = await sendGuardedRequest(
      `http://unsubscribe.test:${port}/`,
      { method: "GET", timeoutMs: 2000, allowedPorts: [port] },
      { ...loopbackAllowed, resolveHost: resolvesTo("127.0.0.1") },
    );
    expect(result).toEqual({ ok: true, value: { status: 204 } });
  });

  it("connects through the single-address lookup when the socket does not ask for all addresses", async () => {
    const result = await sendGuardedRequest(
      `http://unsubscribe.test:${port}/`,
      { method: "GET", timeoutMs: 2000, allowedPorts: [port] },
      {
        ...loopbackAllowed,
        resolveHost: resolvesTo("127.0.0.1"),
        request: requestWithFamilySelection(false),
      },
    );
    expect(result).toEqual({ ok: true, value: { status: 204 } });
  });

  it.each([true, false])("refuses a host name with one public and one private address (autoSelectFamily %s)", async (autoSelectFamily) => {
    const result = await sendGuardedRequest(
      `http://rebind.test:${port}/`,
      { method: "GET", timeoutMs: 2000, allowedPorts: [port] },
      {
        resolveHost: resolvesTo("93.184.215.14", "127.0.0.1"),
        request: requestWithFamilySelection(autoSelectFamily),
      },
    );
    expect(result).toEqual({ ok: false, error: "security.outbound_blocked" });
    expect(received).toHaveLength(0);
  });

  it("refuses a host name that resolves to no address", async () => {
    const result = await sendGuardedRequest(`https://empty.test/`, { method: "GET", timeoutMs: 2000 }, { resolveHost: resolvesTo() });
    expect(result).toEqual({ ok: false, error: "security.outbound_blocked" });
  });

  it("refuses localhost through the real resolver", async () => {
    const result = await sendGuardedRequest(`http://localhost:${port}/`, { method: "GET", timeoutMs: 2000, allowedPorts: [port] });
    expect(result).toEqual({ ok: false, error: "security.outbound_blocked" });
    expect(received).toHaveLength(0);
  });

  it("reports a resolver failure as a failed request", async () => {
    const failing: ResolveHost = (_hostname, _family, callback) => callback(new Error("ENOTFOUND"), []);
    const result = await sendGuardedRequest(`https://missing.test/`, { method: "GET", timeoutMs: 2000 }, { resolveHost: failing });
    expect(result).toEqual({ ok: false, error: "security.outbound_failed" });
  });

  it("reports a refused connection as a failed request", async () => {
    const closedPort = port;
    server.closeAllConnections();
    server.close();
    await once(server, "close");
    server = createServer();
    server.listen(0, "127.0.0.1");
    await once(server, "listening");
    const result = await sendGuardedRequest(`http://127.0.0.1:${closedPort}/`, { method: "GET", timeoutMs: 2000, allowedPorts: [closedPort] }, loopbackAllowed);
    expect(result).toEqual({ ok: false, error: "security.outbound_failed" });
  });

  it("reports a header Node cannot send as a failed request", async () => {
    const result = await sendGuardedRequest(
      `http://127.0.0.1:${port}/`,
      { method: "GET", headers: { "x-note": "line\r\nbreak" }, timeoutMs: 2000, allowedPorts: [port] },
      loopbackAllowed,
    );
    expect(result).toEqual({ ok: false, error: "security.outbound_failed" });
    expect(received).toHaveLength(0);
  });

  it.each([0, -1, 1.5, Number.NaN])("throws on timeoutMs %s", async (timeoutMs) => {
    await expect(sendGuardedRequest("https://example.com/", { method: "GET", timeoutMs })).rejects.toThrow(RangeError);
  });

  it.each([[[]], [[0]], [[65536]], [[443.5]]])("throws on allowedPorts %j", async (allowedPorts) => {
    await expect(sendGuardedRequest("https://example.com/", { method: "GET", timeoutMs: 1000, allowedPorts })).rejects.toThrow(
      RangeError,
    );
  });
});
