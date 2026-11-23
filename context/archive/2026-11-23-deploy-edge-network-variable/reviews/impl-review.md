---
change_id: deploy-edge-network-variable
verdict: approved
---

# Implementation review

Reviewed the diff against `plan.md` and issue #1429.

- **Acceptance 1:** `tools/deploy` and `tools/host` suites green with the new tests; typecheck and lint green.
- **Acceptance 2:** `init --edge=proxy` writes `${EDGE_NETWORK:-proxy}` in the network and the label; the guard passes
  it with `edgeNetwork: "proxy"` and, with `env: { EDGE_NETWORK: "web" }`, with `edgeNetwork: "web"`.
- **Acceptance 3:** `findComposeNames` lists `EDGE_NETWORK` as optional, so `env render` writes it only when set and
  `app add`'s "still to set by hand" list never names it.
- Compose semantics: `:-` replaces unset or empty, `-` only unset, `$$` is a literal dollar, required forms untouched,
  so the edge-proof rule still sees `${EDGE_PROOF_SECRET:?}`. Keys are not interpolated, as in compose.
- Backward compatible: without the variable the app joins the `--edge` network; literal files still pass the guard.
- Releases: deploy (minor feature) and host (patch-level feature) both need a release; CHANGELOGs carry `## Unreleased`.

Findings: none.
