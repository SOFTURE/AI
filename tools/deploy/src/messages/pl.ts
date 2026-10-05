import type { DeployMessages } from "./index.js";

export const pl: DeployMessages = {
  releaseNotes: {
    heading: "{to} ({date})",
    summary: "Zmiany od {from}: pull requesty: {pullRequests}, inne commity: {commits}.",
    summaryFromStart: "Zmiany od pierwszego commita: pull requesty: {pullRequests}, inne commity: {commits}.",
    empty: "Brak zmian od {from}.",
    pullRequests: "Pull requesty",
    commits: "Inne commity",
    fullDiff: "Pełny diff",
  },
};
