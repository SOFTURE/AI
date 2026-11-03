---
change_id: mcp-access-operation-context-getter-990
---

# Research: operation tool registrars with a context getter

## Findings

- `src/jobs/operations.ts`: `registerOperationStatusTool` and `registerOperationCancelTool` read
  `getMcpAccessMessages(options.ctx.config)` at registration (description and error hints) and pass `options.ctx` to
  `getOperation` / `cancelOperation` in every call. The hints are built by the private `getOperationHints`.
- `src/jobs/operation-tasks.ts`: `registerOperationTasks` reads `options.ctx` only inside the request handlers, and
  `describeTask` reads messages from `ctx.config` per request.
- `withToolErrors(work, { hints })` takes the hints before the work runs; with a getter the config is known only
  after the work resolves the context. `answerValue(result, hints)` (`src/server/tools.ts`) turns a result into the
  tool answer, so the work can resolve the context, run the read and answer with that config's hints, while a thrown
  error of the getter still lands in the error boundary.
- `@softure-ai/files/next` exposes `getFilesContext(config?)`: the shape the issue names.
- Messages without a config: `mcpAccessMessages.en` from `src/messages/index.ts`.

## Risks

- An app that passes `getContext` and overrides the description copy in its dictionary but passes no `config` gets the
  English description. Documented; passing `config` fixes it.
