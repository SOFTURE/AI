---
change_id: waitlist-form-on-success-579
---

# Research: waitlist-form-on-success-579

- `modules/waitlist/src/ui/waitlist-form.tsx`: a client component on `useActionState(action, INITIAL_WAITLIST_FORM_STATE)`.
  For `status` `ok` or `confirmation_sent` it returns the `root` div with a `role="status"` notice
  (`messages.form.success` / `confirmationSent`) and, for `ok` with `unsubscribeUrl`, the unsubscribe hint and link.
  Otherwise the form. No callback or slot exists.
- `modules/waitlist/src/contract.ts`: `WaitlistFormState { status: "idle" | "ok" | "confirmation_sent" | "error"; ... }`,
  one interface with optional fields (not a union). `useActionState` yields a new state object per answer.
- `modules/waitlist/src/next/waitlist.tsx`: the server component `<Waitlist />` renders `WaitlistForm` with
  `joinWaitlistAction`; its props are `placement`, `consentLabels`, `classNames`, `unstyled`. Server-to-client props
  must be serialisable: a `ReactNode` is, a function is not.
- Exports: `@softure-ai/waitlist/ui` (`src/ui/index.ts`) exports the form and its types.
- Tests: `modules/waitlist/tests/waitlist-form.test.tsx` (happy-dom, testing-library, an `answering(state)` action mock);
  `next-join.test.tsx` covers `<Waitlist />`.
- Docs: `modules/waitlist/README.md` describes `WaitlistForm` and composing an own form (line ~155); CHANGELOG newest first.
- Issue #580 (parallel thread) carries `retryAfterSeconds` on the rate-limited state and its message: it edits the
  error branch of the same file and the CHANGELOG; the success branch here does not overlap.
