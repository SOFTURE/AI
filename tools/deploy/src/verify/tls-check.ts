import { isIP } from "node:net";
import { connect, type PeerCertificate } from "node:tls";

const DAY_MS = 86_400_000;
const DEFAULT_HTTPS_PORT = 443;

/** The `tls` row of the verify report: one certificate read per run. `daysLeft` is `null` when none was read. */
export interface TlsReport {
  passed: boolean;
  daysLeft: number | null;
  detail: string;
}

/** What the probe learned about the served certificate. */
export interface CertificateFacts {
  validTo: Date;
  issuer: string;
  /** `null` when the certificate is trusted for the host, otherwise the reason (e.g. `CERT_HAS_EXPIRED`). */
  untrustedReason: string | null;
}

export type CertificateProbe = { ok: true; certificate: CertificateFacts } | { ok: false; reason: string };

function formatDay(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/** A certificate name field holds one value, or several when the field repeats. */
function readNameField(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value.join(", ") : value;
}

function readIssuer(certificate: PeerCertificate): string {
  // Typed as always present, but a peer may send a certificate without an issuer name.
  const issuer = certificate.issuer as Partial<PeerCertificate["issuer"]> | undefined;
  return readNameField(issuer?.O) ?? readNameField(issuer?.CN) ?? "unknown issuer";
}

/** Whole days from `now` to the end of the certificate; negative once it has expired. */
export function getDaysLeft(validTo: Date, now: Date): number {
  return Math.floor((validTo.getTime() - now.getTime()) / DAY_MS);
}

/** The `tls` row for a read certificate: it fails when untrusted or when fewer than `minDays` days are left. */
export function checkCertificateExpiry(options: { certificate: CertificateFacts; minDays: number; now: Date }): TlsReport {
  const { certificate, minDays, now } = options;
  const daysLeft = getDaysLeft(certificate.validTo, now);
  const facts = `${daysLeft} days left (until ${formatDay(certificate.validTo)}), issuer ${certificate.issuer}`;
  if (certificate.untrustedReason !== null) {
    return { passed: false, daysLeft, detail: `certificate not trusted (${certificate.untrustedReason}); ${facts}` };
  }
  if (daysLeft < minDays) return { passed: false, daysLeft, detail: `${facts}; expected at least ${minDays}` };
  return { passed: true, daysLeft, detail: facts };
}

/**
 * Opens one TLS connection to `url`'s host and reads the peer certificate without sending a request. The socket is
 * closed on every path; a handshake error or a timeout is a failed probe, never a thrown error.
 */
export function probeCertificate(options: { url: URL; timeoutMs: number; ca?: string | Buffer }): Promise<CertificateProbe> {
  const { url, timeoutMs, ca } = options;
  // A bracketed IPv6 host is passed to the socket without its brackets.
  const host = url.hostname.replace(/^\[(.*)\]$/, "$1");
  const port = url.port === "" ? DEFAULT_HTTPS_PORT : Number(url.port);
  return new Promise((resolve) => {
    // The certificate is read even when it is not trusted, so the row can say why; `authorized` still decides.
    const socket = connect({
      host,
      port,
      ...(isIP(host) === 0 ? { servername: host } : {}),
      ...(ca === undefined ? {} : { ca }),
      rejectUnauthorized: false,
    });
    // The first outcome wins; a promise settles once, so a later timeout or error only closes the socket again.
    const finish = (probe: CertificateProbe): void => {
      socket.destroy();
      resolve(probe);
    };
    socket.setTimeout(timeoutMs, () => finish({ ok: false, reason: `no TLS handshake within ${timeoutMs} ms` }));
    // `on`, not `once`: a second error after the first must not become an unhandled one.
    socket.on("error", (error: NodeJS.ErrnoException) =>
      finish({ ok: false, reason: `TLS connection failed: ${error.code ?? error.message}` }));
    socket.once("secureConnect", () => {
      const certificate = socket.getPeerCertificate();
      const validTo = new Date(certificate.valid_to);
      if (Number.isNaN(validTo.getTime())) {
        finish({ ok: false, reason: "the server sent no certificate with an expiry date" });
        return;
      }
      const untrustedReason = socket.authorized ? null : String(socket.authorizationError);
      finish({ ok: true, certificate: { validTo, issuer: readIssuer(certificate), untrustedReason } });
    });
  });
}

/** The `tls` row for `baseUrl`: an `http` URL has no certificate to read, so it fails without connecting. */
export async function runTlsCheck(options: {
  baseUrl: string;
  minDays: number;
  timeoutMs: number;
  now?: () => Date;
  ca?: string | Buffer;
}): Promise<TlsReport> {
  const { baseUrl, minDays, timeoutMs, ca } = options;
  const url = new URL(baseUrl);
  if (url.protocol !== "https:") {
    return { passed: false, daysLeft: null, detail: `no certificate to check: ${url.protocol} is not https` };
  }
  const probe = await probeCertificate({ url, timeoutMs, ...(ca === undefined ? {} : { ca }) });
  if (!probe.ok) return { passed: false, daysLeft: null, detail: probe.reason };
  return checkCertificateExpiry({ certificate: probe.certificate, minDays, now: (options.now ?? (() => new Date()))() });
}
