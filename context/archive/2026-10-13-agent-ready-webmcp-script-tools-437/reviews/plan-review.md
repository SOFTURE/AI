---
change_id: agent-ready-webmcp-script-tools-437
reviewed: 2026-10-13
verdict: approved
---

# Plan review: agent-ready-webmcp-script-tools-437

Checked plan.md against change.md, research.md, issue #437 and the files it touches.

| # | Severity | Finding | Decision |
|---|---|---|---|
| 1 | Warning | Two implementations can drift. Running every behaviour test against both forms is the guard; keep the suites shared, not copied. | Taken into Phase 2 (one suite, two factories). |
| 2 | Warning | Messages land inside the inline script: `</script>` or U+2028 in a message must not break it. | Taken: the config is serialized like the boot script's (`<` escaped), tested. |
| 3 | Warning | A placeholder the template does not know must stay literal, and a value holding `{x}` must not be expanded again. | Taken: one-pass replace, tested through `noMatch` with a `{scope}`-looking query. |
| 4 | Check | `locale` only drives plural selection; an invalid tag makes `Intl.PluralRules` throw at creation, which is a programming error at build time. | No change; documented. |
| 5 | Check | No dictionary ships; the English defaults are exported so an app sees every key it can override. | No change. |

No Critical findings.
