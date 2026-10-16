---
change_id: ui-header-box-border-542
---

# Research: ui-header-box-border-542

Sources: `foundation/ui/src/ui/app-header-bar.tsx`, every non-test `*.ts`/`*.tsx` in the repository that uses
`sft:w-full` or `sft:w-screen` (`git ls-files | xargs grep`), `foundation/ui/tests/adoption-gaps-407.test.tsx`.

- `inner` is `sft:mx-auto sft:flex sft:h-14 sft:w-full sft:items-center sft:gap-4 sft:px-4`; under `content-box`
  its outer width is 100% + 2rem, which confirms the issue.
- Other full-width default strings without `box-border`:
  - `button.tsx` `WIDTH.full`: combined with the base string, which already has `sft:box-border`.
  - `collapsible-section.tsx` trigger: `sft:p-0 sft:border-0`, so content-box and border-box give the same width.
  - `copy-button.tsx` `fallback`: no padding and no border.
  - `field.tsx`, `copy-button.tsx` input, `modal.tsx` panel, privacy `legal-document` and `legal-footer`: already
    `sft:box-border`.
- So `AppHeaderBar.inner` is the only offender.
- The #407 test renders `AppHeaderBar` with `renderToStaticMarkup`; a new test can read the `inner` element's class.
