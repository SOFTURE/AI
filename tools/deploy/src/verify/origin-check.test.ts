import { createServer, type AddressInfo, type Server, type Socket } from "node:net";
import { afterEach, describe, expect, it } from "vitest";
import { classifyOriginProbe, formatOriginAddress, parseOriginAddress, runOriginCheck } from "./origin-check.js";

describe("parseOriginAddress", () => {
  it("defaults the port to 443 for an IPv4 address and a host name", () => {
    expect(parseOriginAddress("203.0.113.7")).toEqual({ ok: true, address: { host: "203.0.113.7", port: 443 } });
    expect(parseOriginAddress("origin.example.com")).toEqual({ ok: true, address: { host: "origin.example.com", port: 443 } });
  });

  it("reads an explicit port, with and without IPv6 brackets", () => {
    expect(parseOriginAddress("203.0.113.7:8443")).toEqual({ ok: true, address: { host: "203.0.113.7", port: 8443 } });
    expect(parseOriginAddress("[2001:db8::7]:8443")).toEqual({ ok: true, address: { host: "2001:db8::7", port: 8443 } });
    expect(parseOriginAddress("[2001:db8::7]")).toEqual({ ok: true, address: { host: "2001:db8::7", port: 443 } });
    expect(parseOriginAddress("2001:db8::7")).toEqual({ ok: true, address: { host: "2001:db8::7", port: 443 } });
  });

  it.each(["", " ", "https://203.0.113.7", "203.0.113.7/", "user@203.0.113.7", "203.0.113.7:0", "203.0.113.7:65536", "203.0.113.7:x", "a b"])(
    "refuses %j",
    (text) => {
      expect(parseOriginAddress(text).ok).toBe(false);
    },
  );

  it("names the refused text and an example", () => {
    expect(parseOriginAddress("https://203.0.113.7")).toEqual({
      ok: false,
      reason: '"https://203.0.113.7" is not a host or IP address with an optional port, for example 203.0.113.7 or 203.0.113.7:443',
    });
  });
});

describe("formatOriginAddress", () => {
  it("brackets an IPv6 host only", () => {
    expect(formatOriginAddress({ host: "203.0.113.7", port: 443 })).toBe("203.0.113.7:443");
    expect(formatOriginAddress({ host: "2001:db8::7", port: 443 })).toBe("[2001:db8::7]:443");
  });
});

describe("classifyOriginProbe", () => {
  const address = { host: "203.0.113.7", port: 443 };

  it("fails an accepted connection", () => {
    expect(classifyOriginProbe({ address, probe: { outcome: "accepted", remoteAddress: "203.0.113.7" }, timeoutMs: 8000 })).toEqual({
      address: "203.0.113.7:443",
      passed: false,
      detail: "203.0.113.7:443 accepted a direct connection; the firewall lets more than the CDN through",
    });
  });

  it("names the address a host name resolved to when the connection is accepted", () => {
    const report = classifyOriginProbe({
      address: { host: "origin.example.com", port: 443 },
      probe: { outcome: "accepted", remoteAddress: "198.51.100.4" },
      timeoutMs: 8000,
    });
    expect(report.detail).toBe("origin.example.com:443 (198.51.100.4) accepted a direct connection; the firewall lets more than the CDN through");
  });

  it("passes a dropped connection with the timeout", () => {
    expect(classifyOriginProbe({ address, probe: { outcome: "timeout" }, timeoutMs: 8000 })).toEqual({
      address: "203.0.113.7:443",
      passed: true,
      detail: "203.0.113.7:443 no answer within 8000 ms (dropped)",
    });
  });

  it.each([
    ["ECONNREFUSED", "203.0.113.7:443 connection refused (nothing listens there)"],
    ["ECONNRESET", "203.0.113.7:443 connection reset"],
    ["EHOSTUNREACH", "203.0.113.7:443 host unreachable"],
    ["ENETUNREACH", "203.0.113.7:443 network unreachable"],
  ])("passes %s", (code, detail) => {
    expect(classifyOriginProbe({ address, probe: { outcome: "error", code }, timeoutMs: 8000 })).toEqual({
      address: "203.0.113.7:443",
      passed: true,
      detail,
    });
  });

  it("fails an address that does not resolve, since nothing was checked", () => {
    const report = classifyOriginProbe({ address, probe: { outcome: "error", code: "ENOTFOUND" }, timeoutMs: 8000 });
    expect(report).toEqual({
      address: "203.0.113.7:443",
      passed: false,
      detail: "203.0.113.7:443 could not be resolved (ENOTFOUND); nothing was checked",
    });
  });

  it("fails any other error with its code", () => {
    const report = classifyOriginProbe({ address, probe: { outcome: "error", code: "EACCES" }, timeoutMs: 8000 });
    expect(report).toEqual({ address: "203.0.113.7:443", passed: false, detail: "203.0.113.7:443 could not be checked: EACCES" });
  });
});

describe("runOriginCheck against local ports", () => {
  let server: Server | undefined;
  const sockets: Socket[] = [];

  afterEach(async () => {
    for (const socket of sockets) socket.destroy();
    sockets.length = 0;
    const open = server;
    server = undefined;
    if (open?.listening === true) await new Promise<void>((resolve) => open.close(() => resolve()));
  });

  async function listen(): Promise<number> {
    const opened = createServer((socket) => sockets.push(socket));
    server = opened;
    await new Promise<void>((resolve) => opened.listen(0, "127.0.0.1", resolve));
    return (opened.address() as AddressInfo).port;
  }

  it("fails when the port accepts the connection", async () => {
    const port = await listen();
    const report = await runOriginCheck({ address: { host: "127.0.0.1", port }, timeoutMs: 2000 });
    expect(report).toEqual({
      address: `127.0.0.1:${port}`,
      passed: false,
      detail: `127.0.0.1:${port} accepted a direct connection; the firewall lets more than the CDN through`,
    });
  });

  it("passes when the port refuses the connection", async () => {
    const port = await listen();
    await new Promise<void>((resolve) => server?.close(() => resolve()));
    const report = await runOriginCheck({ address: { host: "127.0.0.1", port }, timeoutMs: 2000 });
    expect(report).toEqual({
      address: `127.0.0.1:${port}`,
      passed: true,
      detail: `127.0.0.1:${port} connection refused (nothing listens there)`,
    });
  });

  it("fails a host name that does not resolve", async () => {
    const report = await runOriginCheck({ address: { host: "origin.softure-deploy.invalid", port: 443 }, timeoutMs: 5000 });
    expect(report.passed).toBe(false);
    expect(report.detail).toMatch(/^origin\.softure-deploy\.invalid:443 could not be resolved \((ENOTFOUND|EAI_AGAIN)\); nothing was checked$/);
  });
});
