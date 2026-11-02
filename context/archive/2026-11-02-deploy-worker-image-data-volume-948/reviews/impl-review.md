---
change_id: deploy-worker-image-data-volume-948
verdict: approved
---

# Implementation review

Reviewed the diff of b20750e..e7afb79 against plan.md and the issue's four proposals.

- Default output: the e2e app (`npm run e2e-app -w @softure-ai/deploy`) renders byte for byte the same, and every
  existing init, server-files and workflow test passes unchanged; each new part sits behind its own flag, input or key.
- Values: `workerDockerfile`, `dataVolume`, `workerCpus`, `workerMemory`, `workerTmpfs` and `data.backupPaths` are
  pattern-checked (no `..`, no system folder, Docker's size and CPU forms) before they reach YAML or bash; deploy.sh
  checks the backup paths again and passes them as `./<path>`, so none reads as a tar option.
- Workflow: the worker build reuses the app build's context, build arguments and labels, with its own cache scope;
  `prebuilt-image` and `e2e` with `worker-dockerfile` are refused in the check job, before anything is built.
- Server script: the worker image is pulled through the same registry login, cleaned up in `maintain`; the data archive
  is written with umask 077 into a hidden file and renamed only on success; a one-off `compose run` carries
  `traefik.enable=false`, so an edge Traefik never routes to it (found in review, fixed in p4). Bash 3.2 only.
- Guard: `dataVolume` handles short and long volume syntax, anonymous volumes, host folders and an undeclared name.
- Docs: README (init flags, the three parts, data backup, workflow input and outputs, guard rules) and CHANGELOG
  Unreleased with the app's migration steps.

Follow-up (not in scope): `deploy-release-image.yml` (an image built next to the checks) has no worker image yet; an
app on that path keeps one image until it needs one.

Verdict: approved.
