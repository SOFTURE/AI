# Research: host-preflight-cert-resolver

- `checkOnboarding` (`tools/host/src/survey/preflight.ts`, #1432) runs in `app add` before any change and in
  `--check`; it lists problems (stop) and notes. It already resolves compose interpolation (`resolveComposeValue`)
  and compares the external networks with `edge.network` (with `EDGE_NETWORK` set to it) and checks the network on
  the server. Nothing reads `tls.certresolver`.
- `softure-deploy init --edge` writes `traefik.http.routers.<name>.tls.certresolver=letsencrypt` (and `<name>-www`
  with `--www`); `edge.certResolver` defaults to `letsencrypt`.
- Labels appear as a `key=value` list or a map, on the service or under `deploy.labels` (same reading as
  `checkSharedHostCompose`).
