# Plan review: marketing-kit-og-subset-fonts

Reviewed: plan.md @ 2026-10-04. Mode: quick. Verdict: ready after fixes.
Findings: 0 critical, 2 warnings, 1 suggestion.
Grounding: 9/9 paths, 7/7 symbols, 4/4 commands

## Lenses
| Lens | Result |
| --- | --- |
| Coverage and end state | PASS (render test with latin + latin-ext at 400 and 700; off-weight refusal) |
| Slicing | PASS (one phase, one owned folder) |
| Verifiability | PASS |
| Data and migrations | PASS (none) |
| Tests | WARN (S1) |
| Security | PASS (no new input parsing beyond a string split) |
| Lean | WARN (W2) |
| Fit | WARN (W1) |
| Cost and defaults | PASS |

## Findings

### W1 [WARNING] Quoting the stack rewrites every template tree
**Effort:** low. **Lens:** Fit. **Where:** Key decisions "Stack in templates" · `tests/og/__snapshots__`
**Problem:** `"Inter", "Inter #2"` with quotes changes `fontFamily` for every brand, including
single-file ones, so the template snapshots move for no visible change, and the quotes buy nothing:
Satori trims each name and keeps inner spaces and `#`.
**Fix:** unquoted `Inter, Inter #2`, and just `Inter` without subset files.
**Decision:** Fix now (applied): Goal, Key decisions, Tests.

### W2 [WARNING] Refusing quotes and commas in a family adds a failure nobody hit
**Effort:** low. **Lens:** Lean. **Where:** Phase 1 step 1, Key decisions "Family names"
**Problem:** a family with a comma already renders today (Satori splits it, nothing matches, and the
fallback draws it by load order); a new refusal would break such a config for no gain once the
glyph check splits the string the same way Satori does.
**Fix:** no refusal; `parseFontFamily` mirrors `expand.ts`, with a test.
**Decision:** Fix now (applied).

### S1 [SUGGESTION] Pin the stack-before-load-order rule with a test that would fail without it
**Effort:** low. **Lens:** Tests. **Where:** Phase 1 Tests (glyphs)
**Problem:** a check that walks families in load order only passes every other planned test when
the stack's family happens to load first.
**Fix:** a family loaded before the stack maps the character at 700 while `#2` has only 400; the
character must still be reported.
**Decision:** Fix now (applied).

Fixed: W1, W2, S1. Accepted: -. Deferred: -. Dismissed: -. Verdict after triage: ready.
