---
change_id: deploy-worker-bundle-marketing-kit-995
verdict: approved
---

# Implementation review

Reviewed the diff of d99c100..004deeb against plan.md and the issue's three proposals.

- Template: `--external:@softure-ai/marketing-kit` sits next to the other externals, with a comment naming the three
  reasons (native `.node` binaries, playwright's optional `chromium-bidi` imports, the kit's run-time
  `createRequire`). The runtime stage already copies the pruned `node_modules`, and the kit is a dependency of the app,
  so it survives `npm prune --omit=dev`.
- Test: `tests/worker-bundle.test.ts` reads the externals, the `server-only` alias and the banner from the generated
  worker Dockerfile and bundles an entry importing the kit's footage blocks; it failed on master with the issue's four
  errors and passes now. The kit is a declared devDependency of deploy.
- Compatibility: the app Dockerfile and every existing init test are unchanged (the deploy suite passes, 874 tests).
- Docs: CHANGELOG Unreleased with the one flag a 0.5.0 app adds; README's starter description names the external kit.

Verdict: approved.
