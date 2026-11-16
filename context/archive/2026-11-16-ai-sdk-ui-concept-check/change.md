---
change_id: ai-sdk-ui-concept-check
title: "research: AI SDK UI against the design kits and @softure-ai/llm (concept check)"
status: archived
archived_at: 2026-11-16
roadmap_item: null
issue: 1248
branch: claude/project-thread-ub4gug
created: 2026-11-16
updated: 2026-11-16
---

## Intent

Decide, with evidence, whether apps assembled from `@softure-ai/*` should get their AI-facing UI (chat, streamed
answers, tool calls, generative UI) from [AI SDK UI](https://ai-sdk.dev/docs/ai-sdk-ui/overview) (`@ai-sdk/react`)
rendered through the design kits (`ui`, `theme-kit`, `theme-notion`, `theme-flat-paint`), and if so where it lives.
The outcome is a finding and a recommendation, not a shipped package.

## Context

Issue #1248 (status "later", scheduled explicitly). Today each app builds chat UI by hand on top of `@softure-ai/llm`,
so the result is inconsistent and does not follow the design kits. The issue asks eight questions (stack fit, fit
with `llm`, where it lives, theme contract, generative UI, messages and accessibility, security and limits, cost of
adoption) and wants a spike in `examples/next-app` with screenshots for `theme-notion` and `theme-flat-paint`.

## Scope

- `research.md`: an answer to each of the eight questions, with the versions tested and links to the AI SDK docs.
- A throwaway spike in `examples/next-app` (`useChat` streaming through a route that uses `@softure-ai/llm`'s model
  type and price table, one tool call rendered as a themed card, both themes), run in a browser, screenshotted, and
  kept outside the repository as a patch. Nothing of the spike is committed.
- A recommendation (integrate and where, document only, or drop) with trade-offs; follow-up issue drafts per package
  and, for a new package, a proposal for the owner.

## Constraints

- No release and no change to published packages (`foundation/*`, `modules/*`, `themes/*`).
- No paid model call: the spike streams from AI SDK's mock model.
- English in everything written to the repository.
- A new package is a proposal for the owner, not a decision of this change.

## Notes

- Framing: skipped. The issue is itself a framing exercise (a concept check with an explicit decision as its outcome).
- Plan, plan-review and implement: the deliverable is research plus a throwaway spike that is not committed; the
  chain continues with a follow-up change per accepted follow-up issue.

## Done

- Finding and recommendation in `research.md`: integrate in `llm` (streamed chat) and `ui` (chat primitives on the
  `--sft-*` tokens), no new package now.
- Follow-up issues: #1258 (llm), #1259 (ui), #1260 (theme-notion), #1261 (theme-flat-paint), #1262 (example app).
- Owner proposal: a thin `@softure-ai/ai-ui` package (the `useChat` adapter and tool registry) only when a second
  consumer needs the mapping.
