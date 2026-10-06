import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { createServer as createTcpServer, type AddressInfo, type Server as TcpServer, type Socket } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createServer, type Server } from "node:tls";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { checkCertificateExpiry, getDaysLeft, runTlsCheck } from "./tls-check.js";

const NOW = new Date("2026-10-06T12:00:00Z");

describe("checkCertificateExpiry", () => {
  const certificate = { validTo: new Date("2026-10-20T12:00:00Z"), issuer: "Let's Encrypt", untrustedReason: null };

  it("passes with exactly the minimum left and names days, date and issuer", () => {
    expect(checkCertificateExpiry({ certificate, minDays: 14, now: NOW })).toEqual({
      passed: true,
      daysLeft: 14,
      detail: "14 days left (until 2026-10-20), issuer Let's Encrypt",
    });
  });

  it("fails one day under the minimum, counting whole days only", () => {
    const now = new Date("2026-10-06T12:00:01Z");
    expect(checkCertificateExpiry({ certificate, minDays: 14, now })).toEqual({
      passed: false,
      daysLeft: 13,
      detail: "13 days left (until 2026-10-20), issuer Let's Encrypt; expected at least 14",
    });
  });

  it("fails an untrusted certificate whatever its days left", () => {
    const untrusted = { ...certificate, untrustedReason: "CERT_HAS_EXPIRED" };
    expect(checkCertificateExpiry({ certificate: untrusted, minDays: 1, now: NOW })).toEqual({
      passed: false,
      daysLeft: 14,
      detail: "certificate not trusted (CERT_HAS_EXPIRED); 14 days left (until 2026-10-20), issuer Let's Encrypt",
    });
  });

  it("counts negative days once the certificate has expired", () => {
    expect(getDaysLeft(new Date("2026-10-04T12:00:00Z"), NOW)).toBe(-2);
  });
});

describe("runTlsCheck against a local TLS server", () => {
  let dir: string;
  let cert: Buffer;
  let server: Server;
  let baseUrl: string;

  beforeAll(async () => {
    dir = mkdtempSync(join(tmpdir(), "softure-deploy-tls-"));
    const [keyFile, certFile] = [join(dir, "key.pem"), join(dir, "cert.pem")];
    execFileSync("openssl", [
      "req", "-x509", "-newkey", "rsa:2048", "-nodes", "-days", "30",
      "-subj", "/O=Softure Test CA/CN=localhost", "-addext", "subjectAltName=DNS:localhost",
      "-keyout", keyFile, "-out", certFile,
    ], { stdio: "ignore" });
    cert = readFileSync(certFile);
    server = createServer({ key: readFileSync(keyFile), cert }, (socket) => socket.end());
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    baseUrl = `https://localhost:${(server.address() as AddressInfo).port}`;
  });

  afterAll(async () => {
    await new Promise<void>((resolve) => server.close(() => resolve()));
    rmSync(dir, { recursive: true, force: true });
  });

  it("passes a trusted certificate with enough days left", async () => {
    const report = await runTlsCheck({ baseUrl, minDays: 14, timeoutMs: 2000, ca: cert });
    expect(report.passed).toBe(true);
    expect(report.daysLeft).toBe(29);
    expect(report.detail).toMatch(/^29 days left \(until \d{4}-\d{2}-\d{2}\), issuer Softure Test CA$/);
  });

  it("fails when fewer days are left than the minimum", async () => {
    const report = await runTlsCheck({ baseUrl, minDays: 45, timeoutMs: 2000, ca: cert });
    expect(report.passed).toBe(false);
    expect(report.detail).toMatch(/^29 days left \(until \d{4}-\d{2}-\d{2}\), issuer Softure Test CA; expected at least 45$/);
  });

  it("fails an untrusted certificate with the reason", async () => {
    const report = await runTlsCheck({ baseUrl, minDays: 14, timeoutMs: 2000 });
    expect(report.passed).toBe(false);
    expect(report.detail).toMatch(/^certificate not trusted \(DEPTH_ZERO_SELF_SIGNED_CERT\); 29 days left/);
  });

  it("fails a certificate issued for another host name", async () => {
    const port = (server.address() as AddressInfo).port;
    const report = await runTlsCheck({ baseUrl: `https://127.0.0.1:${port}`, minDays: 14, timeoutMs: 2000, ca: cert });
    expect(report.passed).toBe(false);
    expect(report.detail).toMatch(/^certificate not trusted \(ERR_TLS_CERT_ALTNAME_INVALID\); 29 days left/);
  });
});

describe("runTlsCheck without a certificate", () => {
  let silent: TcpServer | undefined;
  const held = new Set<Socket>();

  async function closeSilent(): Promise<void> {
    const current = silent;
    silent = undefined;
    for (const socket of held) socket.destroy();
    held.clear();
    if (current !== undefined) await new Promise<void>((resolve) => current.close(() => resolve()));
  }

  afterEach(closeSilent);

  async function listenSilently(): Promise<number> {
    // Accepts the connection and never answers, so the TLS handshake cannot complete.
    const server = createTcpServer((socket) => held.add(socket));
    silent = server;
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    return (server.address() as AddressInfo).port;
  }

  it("fails an http URL without connecting", async () => {
    expect(await runTlsCheck({ baseUrl: "http://127.0.0.1:9", minDays: 14, timeoutMs: 100 })).toEqual({
      passed: false,
      daysLeft: null,
      detail: "no certificate to check: http: is not https",
    });
  });

  it("names the connection error when nothing listens", async () => {
    const port = await listenSilently();
    await closeSilent();
    expect(await runTlsCheck({ baseUrl: `https://127.0.0.1:${port}`, minDays: 14, timeoutMs: 2000 })).toEqual({
      passed: false,
      daysLeft: null,
      detail: "TLS connection failed: ECONNREFUSED",
    });
  });

  it("gives up when the server never answers the handshake", async () => {
    const port = await listenSilently();
    expect(await runTlsCheck({ baseUrl: `https://127.0.0.1:${port}`, minDays: 14, timeoutMs: 150 })).toEqual({
      passed: false,
      daysLeft: null,
      detail: "no TLS handshake within 150 ms",
    });
  });
});
