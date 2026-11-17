# Research: security-edge-proof-ip

- `ClientIpResolver = (headers: Headers) => string | null` (`client-ip.ts`); `cloudflareIp()` is `headerIp("cf-connecting-ip")`.
  `security()` normalises every result and refuses an unidentified request by default, so a wrapper that returns
  `null` makes an unproven request fall into `unidentified` (production: `refuse`).
- `init --edge` (`docker-compose.yml.tmpl`, `{{#edge}}`) publishes the app with labels: router `<name>` with the
  middleware `<name>-security-headers`; with `--www` a router `<name>-www` on `noop@internal`. The app joins the
  external edge network, so every container on that network reaches `app:3000` without Traefik.
- Traefik's `headers.customrequestheaders.<Name>=<value>` sets (overwrites) a request header before the request reaches
  the service; a client's own value never survives. Compose interpolates `${VAR}` in labels.
- Every `${NAME:?}` in the compose file is a required secret: `findRequiredNames` feeds the caller workflow's secret
  list and `env render`, so a new `${EDGE_PROOF_SECRET:?}` becomes an Environment secret with no workflow change.
- `checkSharedHostCompose` reads labels into a map, routers (`rule`, `middlewares`) and middleware types (with
  chains). A check that each routing router (service not `*@internal`) runs a `headers` middleware setting the proof
  header fits there. Making it default-on changes the result for apps that pass today: a minor bump and a CHANGELOG
  migration line, with an opt-out.
- Constant-time comparison: `crypto.timingSafeEqual` needs equal lengths; comparing SHA-256 digests of both values
  avoids leaking the length.
- `client-ip.ts` already imports `node:net`, so `node:crypto` adds no new runtime constraint to the root entry.
