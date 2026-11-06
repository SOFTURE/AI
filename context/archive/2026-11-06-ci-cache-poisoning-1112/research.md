# Research: CodeQL cache poisoning alerts on deploy-release-checks.yml

## What the rule matches

CodeQL's `actions/cache-poisoning/poisonable-step` (`CachePoisoningViaPoisonableStep.ql`) reports a step that runs
checked-out code when, in the same job:

1. a checkout is a `PRHeadCheckoutStep`: its `ref` is tainted by a pull request context, or, by a name heuristic, its
   `ref` is an expression whose field name matches `.*(head|branch|ref).*` (mutable ref) or `.*(head|sha|commit).*`
   (SHA) (`UntrustedCheckoutQuery.qll`, `ActionsMutableRefCheckout` and `ActionsSHACheckout`);
2. no control check (actor, association, label, permission) guards it;
3. the job's trigger (a reusable workflow inherits its caller's) can write the default branch's cache: here
   `workflow_dispatch` of `e2e-deploy.yml`.

## Local reproduction

CodeQL CLI 2.27.4, `codeql database create --language=actions` on master (befa852), then the query above: exactly four
results, at lines 284, 288, 320 and 324 of `deploy-release-checks.yml`, each naming `needs.prepare.outputs.ref` (lines
268 and 312) as the untrusted checkout. These are alerts #52 to #55.

## Is the checkout untrusted?

No. `prepare` writes `ref` empty without a tag (the jobs then check out the caller's own commit, `github.sha`) and, with
a tag, the tag's commit only after it proved that commit is on the release branch. The match comes only from the
output's name `ref`.

## Options

1. Rename the output to a name that says what it is and does not match the heuristic (`revision`). Same behaviour,
   alerts closed by the next scan of master.
2. Leave it and have the owner dismiss the four alerts as false positives. Keeps the noise for the next similar
   workflow and needs the owner.
3. Drop the caches. Does not help: the rule needs no cache step, only the trigger.

Recommended: option 1, with a comment at the output that says why the commit is trusted.
