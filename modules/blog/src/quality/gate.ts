// The quality gate for `softure-blog publish` (FIRE_TRACKER `src/lib/blog/quality/publish-gate.ts`):
// the errors of a file going public, one line each. Internal links are not resolved here, since a
// container that publishes may hold no app folder; `softure-blog check` in CI resolves them.
import type { Clock } from "@softure-ai/core";
import type { PublishGate } from "../db/publish-run.js";
import { checkArticle } from "./check-article.js";
import { formatFinding } from "./finding.js";
import { getLocalDate, type QualitySettings } from "./settings.js";

export function createQualityGate(settings: QualitySettings, clock: Clock): PublishGate {
  return (file, article) => {
    const { findings } = checkArticle({ article, text: file.text, settings, today: getLocalDate(clock.now(), settings.timeZone) });
    return findings.filter((finding) => finding.severity === "error").map(formatFinding);
  };
}
