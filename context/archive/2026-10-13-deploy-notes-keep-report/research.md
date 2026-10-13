---
change_id: deploy-notes-keep-report
---

# Research: deploy-notes-keep-report (issue #436)

## Current state

- `.github/workflows/deploy-release-notes.yml`: `workflow_call` with `tag` and `body`; step "Check the inputs"
  (tag pattern, non-empty body), step "Replace the release body" (`printf '%s' "$BODY" > file`,
  `gh release edit "$TAG" --notes-file file`). Job permission `contents: write`, which also allows `gh release view`.
- Callers: `tools/deploy/examples/release-notes.yml` and the template
  `tools/deploy/templates/.github/workflows/release-notes.yml.tmpl`; `generate.test.ts` asserts the generated caller
  parses equal to the example, and `tests/repo/deploy-workflows.test.ts` pins the example's inputs and `with:`.
- Section markers come from `tools/deploy/src/notes/release-body.ts`: `<!-- softure-deploy:<key> -->` …
  `<!-- /softure-deploy:<key> -->`, keys `release-notes`, status, deployments, in a fixed order at the end of the
  body (README "Order"). So "everything from the first opening marker" is exactly the generated part.
- Tests run the step scripts with `bash -e -c` and a fake `gh` on `PATH` (`runScript`).

## Reading the current body

`gh release view <tag> --repo <repo> --json body --template '{{.body}}'` prints the body without a trailing newline
added by `--jq`. The script reads it into a variable with `IFS= read -r -d '' body < file || true`, which keeps
trailing newlines and works in bash 3.2. The kept part is `"<!-- softure-deploy:${current#*<!-- softure-deploy:}"`,
taken only when the marker occurs (`[[ "$current" == *"<!-- softure-deploy:"* ]]`).

## Joining

New body = `body` with trailing whitespace trimmed, a blank line, then the kept part. That matches how `release-notes`
lays out its sections under the owner's text.

## Risks

- A `body` containing a marker would double the sections: refused in "Check the inputs" when `keep-report` is on.
- Reading and writing are not atomic: a deploy writing a section between view and edit could be lost. The job's
  concurrency group covers this workflow only; acceptable, the window is a second and the next deploy rewrites
  its section.
