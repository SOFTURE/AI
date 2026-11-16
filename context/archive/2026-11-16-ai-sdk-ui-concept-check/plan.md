# Plan: ai-sdk-ui-concept-check

## Phases

1. Record the finding: `research.md` (eight answers, versions, spike evidence, recommendation). The spike itself stays
   outside the repository (a patch and screenshots kept with the project's files), as the issue allows.
2. File the follow-up issues drafted in `research.md` (llm, ui, theme-notion, theme-flat-paint, examples/next-app)
   in SOFTURE/AI, each linking #1248; record their numbers below. The optional `@softure-ai/ai-ui` package goes to the
   owner as a proposal, not as an issue.

## Acceptance

- Every question of #1248 answered in `research.md` with the versions tested (evidence: the file).
- Spike ran: `useChat` streamed from a mock model, a tool call rendered as a card, both themes in light and dark,
  no page errors (evidence: the screenshots and the stream capture described under `## Spike`).
- Five follow-up issues exist (evidence: their numbers in Progress).
- No published package changed (evidence: the diff touches only `context/`).

## Decisions (auto)

- Integrate in `llm` and `ui`, no new package now (the spike showed the themes need no own chat code).
- The spike is not committed: adding `ai`, `@ai-sdk/react` and Tailwind to the example app is the job of the
  example follow-up, once `llm.streamChat` and ui's chat primitives exist.

## Progress

- [x] p1 finding recorded: research.md (8 answers, ai 7.0.173, @ai-sdk/react 4.0.177, spike in both themes, light and dark, no page errors)
- [x] p2 follow-up issues filed: #1258 llm, #1259 ui, #1260 theme-notion, #1261 theme-flat-paint, #1262 example
