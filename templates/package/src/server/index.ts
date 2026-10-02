// Server-only logic. Every function receives `{ db, clock }` and never reads request scope;
// `next/*` imports are not allowed here (ESLint `no-restricted-imports`, NFR-3).

/** Placeholder: returns the module id so the build has something to emit. */
export function getModuleId(): string {
  return "template-module";
}
