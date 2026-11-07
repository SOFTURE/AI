---
change_id: marketing-kit-audit-reachability-1191
verdict: approved
---

# Plan review (auto)

- Scope matches #1191's second outcome: the kit documents why the findings do not apply, and the guard keeps the
  undici claim true in code. Lifting the pins is not in the kit's power until upstream releases.
- Compatibility: today's compositions carry no remote reference, so the guard changes no output; a caller passing
  a URL as an asset gets an error instead of hyperframes downloading it at render time.
- Risk: the SVG namespace (`xmlns="http://www.w3.org/2000/svg"`) is not a `src`, `href` or `url(`, so the pattern
  does not trip on it. Approved.
