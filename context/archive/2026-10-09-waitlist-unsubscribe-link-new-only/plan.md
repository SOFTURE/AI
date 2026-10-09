# Plan: waitlist-unsubscribe-link-new-only

## Approach

1. Tests first (`tests/next-join.test.tsx`): a known address gets `{ status: "ok" }` without a link; a suppressed
   address gets the same answer as a known one, without a link, and no mail. The existing "new and known get the
   same link" test is narrowed to the new sign-up. Both new expectations fail on master.
2. `src/next/actions.ts`: add the link only when `joined.status === "joined" && joined.isNew`.
3. Docs: the option's JSDoc, the contract's `unsubscribeUrl` JSDoc, README's option table and the unsubscribe section.
4. Version 0.1.9 (`package.json`, `module.json`, `package-lock.json`), CHANGELOG `## 0.1.9`.

## Decisions (auto)

- **D1: a link for `isNew` only, not for every `joined`.** The issue's proposal says `joined.status === "joined"`,
  but a known address also returns `joined` (with `isNew: false`) and was the leak's main path. The adopting app's
  workaround uses `isNew`; so does this fix.
- **D2: the link's absence is an accepted, documented signal.** A repeat submitter can tell a known address from a
  new one by the missing link. The issue accepts this trade; it reveals membership, never a credential. Known and
  suppressed stay indistinguishable. Documented in the README option row.

## Progress

- [x] 1. Failing tests (2 failed on master, as expected)
- [x] 2. Fix
- [x] 3. Docs
- [x] 4. Version and CHANGELOG
