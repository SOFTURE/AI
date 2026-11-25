# Plan review: auth-invitation-revoke-confirm

Verdict: approve. Wrapping the existing form keeps the server action, its pending and error state, the redirect and
the no-JavaScript path untouched; only the click is intercepted. `Modal` already returns focus to the opener, so the
issue's focus requirement is met by the primitive and asserted by the test. Making the new keys optional and merging
over English keeps every app's dictionary compiling. The test covers the issue's acceptance (dialog, cancel keeps,
confirm revokes). No version bump, in line with batched releases.
