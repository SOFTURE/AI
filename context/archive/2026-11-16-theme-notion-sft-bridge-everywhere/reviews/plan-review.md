# Plan review: theme-notion-sft-bridge-everywhere

- Visible change for apps (Warning, accepted): ui components outside a frame change from ui's default look to Notion.
  That is the issue's intent; the CHANGELOG names it so an app that wanted the old look can scope its own override.
- Cascade (Warning, accepted): unlayered aliases beat `@layer softure`; an app's own `--sft-*` override written after
  the import still wins by order. The browser test checks the nested `.dark` band, where a root-only alias would fail.
- Existing gallery baselines (Suggestion, accepted): the gallery's stylesheet does not import the bridge, so its 144
  baselines do not move; the bridge page is separate.
- Dependency on #1259 (Suggestion, accepted): phase 2's chat screenshots wait for #1259 on master; phases 1, 3 and 4
  go first.
- Verdict: approve.
