---
change_id: theme-flat-paint-modal-look
verdict: approved
---

# Plan review

- Coverage: every ask of #781 has a step (keyframes, three classes, slot maps, helper).
- Risk: plain classes in `page.css` are not Tailwind utilities, so `cn` does not merge them; they never conflict with
  a utility. Accepted.
- Risk: `dialog-enter` at 40 rem must match ui's `sm:` centring; Tailwind v4's `sm` is 40 rem. Accepted.
- Risk: ui's closing state with every transition off closes at once; that is the design system's "no exit
  animation". Accepted.
