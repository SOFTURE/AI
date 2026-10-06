# Research: deploy-verify-cert-expiry

Date: 2026-10-06. Sources: the roadmap item, `tools/deploy/src/verify/` (DP-4), the Node 22 `node:tls` docs and a
local experiment (a `tls.createServer` with an `openssl req -x509` certificate). FIRE_TRACKER's
`scripts/verify-production.sh` could not be read (the limit recorded in DF-1).

## Questions

1. **How is the certificate read?** `tls.connect({ host, port, servername })`; on
   `secureConnect`, `socket.getPeerCertificate()` gives `valid_to` (a date string `Date` parses), `issuer` (`O`,
   `CN`) and `subject`; `socket.authorized` and `socket.authorizationError` (checked in the experiment: `DEPTH_ZERO_SELF_SIGNED_CERT`
   without the CA, `ERR_TLS_CERT_ALTNAME_INVALID` for another server name, so the host name is checked too). Verification stays on (CodeQL flags
   `rejectUnauthorized: false`, and the implementation review took that): an untrusted certificate fails the handshake
   with one of those codes, which the row reports.
2. **SNI.** `servername` must not be an IP address (Node warns and the server gets no name); it is set only when
   `net.isIP(host) === 0`. The port is the URL's, or 443.
3. **Days left.** `Math.floor((validTo - now) / 86_400_000)`; a check passes when `daysLeft >= tlsMinDays`. An
   expired certificate gives a negative number and fails anyway. `now` is an input so the boundary is tested exactly.
4. **Once per run.** One connection to the host of the base URL, run alongside the routes; every route shares that
   host (`joinUrl`), so one certificate is the one served.
5. **An `http://` URL with `tlsMinDays`.** There is no certificate to read; the `tls` row fails and says so, since
   the config asks for a check that cannot run (verifying a local `http` build with a production `deploy.json` is a
   wrong pairing, not a pass).
6. **Behind Cloudflare** the certificate seen is the edge one, which Cloudflare renews; the check matters for an
   origin served directly (Traefik with ACME). Said in the README.
7. **Tests without the network.** `openssl req -x509 -newkey rsa:2048 -nodes -days <n> -subj /CN=localhost
   -addext subjectAltName=DNS:localhost` in a temp folder (openssl is on the CI runners and in this container); the
   check takes an optional `ca` so the generated certificate is trusted in the test, and without it the untrusted
   path is tested.
