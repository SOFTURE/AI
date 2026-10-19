---
change_id: mcp-access-token-focus-590
status: done
---

# Research: focus handling in TokenManager (issue #590)

- `modules/mcp-access/src/ui/token-manager.tsx`: `IssueForm` holds the `useActionState` of the issue action and a
  `dismissedId`; `IssuedTokenPanel` renders when the state is `ok` and its id is not dismissed. "Done" calls
  `setDismissedId(issued.id)`, which unmounts the panel together with the focused button. No focus management exists.
- The panel heading is an `<h3>` with the `heading` slot class; adding `tabIndex={-1}` does not change its look.
- `TextField` (`foundation/ui/src/ui/form-fields.tsx`) renders an `<input name="name">` inside the form; reaching it
  through the form's `elements` avoids a ref API on the ui primitive.
- Tests: `modules/mcp-access/tests/token-manager.test.tsx` runs under happy-dom, which implements `focus()`,
  `document.activeElement` and `requestAnimationFrame`.
- Other modules use `useEffect`/`useRef` in client components (`waitlist-form.tsx`), so the pattern is established.
