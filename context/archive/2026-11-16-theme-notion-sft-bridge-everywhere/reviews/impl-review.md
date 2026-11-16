# Implementation review: theme-notion-sft-bridge-everywhere

- Plan drift: none. Option A as planned; the bridge page shows ui's chat primitives from #1259 (merged in at 842f4f7).
- Correctness (checked): the alias block is unlayered on `:root, .light, .dark, [data-theme], [data-page-frame]`; the
  browser checks compare every bridged colour with its Notion target in the shell, a frame and a `.dark` band, in
  both schemes, and fail on master's bridge (shell and dark band).
- Tests: unit tests on the stylesheet's shape; browser checks, four baselines and axe in `visual/bridge.spec.ts`.
  Existing gallery baselines unchanged (160 passed).
- Baselines (Warning, accepted): taken on Chromium headless shell 1243 because 1254 cannot be downloaded here; the
  160 existing baselines pass on 1243, and the PR's `themes` job checks them on 1254.
- Docs: README (bridge paragraph, Testing layer 6), CHANGELOG `## Unreleased`.
- Verdict: approve.
