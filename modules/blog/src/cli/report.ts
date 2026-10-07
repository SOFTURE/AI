// How `softure-blog publish` prints its result: for a person (the default) or as a line contract a
// release script parses (`--format lines`). Both get the same events; only the wording differs.
//
// The line contract: every line starts `blog|`, fields are separated by `|`, and a `|` or a line break
// inside a value becomes a space. Keys are stable English words; a new key may be added, an existing
// one never changes meaning. A run prints exactly one outcome line: `blog|written`, `blog|dry-run`,
// `blog|refused` or `blog|failed|<message>`.
//
//   blog|warning|<subject>|<message>
//   blog|error|<subject>|<message>                    (before blog|refused)
//   blog|change|<added|changed|unchanged>|<id>|<status/slug before or none>|<status/slug after>
//   blog|moved|<id>|<old slug>|<new slug>
//   blog|imported|<id>|<published_at ISO or none>|<old slugs>
//   blog|summary|<added>|<changed>|<unchanged>
//   blog|cache|<off|skipped|dry-run|refreshed|failed>|…
//   blog|indexnow|<off|skipped|dry-run|submitted|failed>|…
import type { BlogRefreshOutcome } from "../discovery/refresh.js";
import { BLOG_REFRESH_SECRET_ENV } from "../discovery/refresh.js";
import type { BlogIndexNowSubmit } from "../discovery/submit.js";
import type { BlogPublishRun, PublishedChange, PublishProblem } from "../db/publish-run.js";

export interface CliOutput {
  readonly log: (line: string) => void;
  readonly error: (line: string) => void;
}

export type PublishFormat = "text" | "lines";

export interface PublishReporter {
  /** A problem before or outside the run (a file it cannot read, the database); the run's outcome. */
  readonly failed: (message: string) => void;
  readonly run: (run: BlogPublishRun) => void;
  readonly refresh: (outcome: BlogRefreshOutcome) => void;
  readonly indexNow: (submit: BlogIndexNowSubmit) => void;
}

export function createPublishReporter(format: PublishFormat, output: CliOutput): PublishReporter {
  return format === "lines" ? createLineReporter(output) : createTextReporter(output);
}

function countActions(run: Extract<BlogPublishRun, { status: "done" }>): Record<PublishedChange["action"], number> {
  const count = (action: PublishedChange["action"]) => run.changes.filter((change) => change.action === action).length;
  return { added: count("added"), changed: count("changed"), unchanged: count("unchanged") };
}

function formatBefore(change: PublishedChange): string {
  return change.statusBefore === null || change.slugBefore === null ? "none" : `${change.statusBefore}/${change.slugBefore}`;
}

function formatDate(date: Date | null): string {
  return date === null ? "none" : date.toISOString();
}

function createTextReporter(output: CliOutput): PublishReporter {
  const formatProblem = (problem: PublishProblem) => `${problem.subject}: ${problem.message}`;
  return {
    failed: (message) => output.error(`softure-blog publish: ${message}`),
    run: (run) => {
      for (const warning of run.warnings) output.error(`warning ${formatProblem(warning)}`);
      if (run.status === "refused") {
        for (const problem of run.problems) output.error(`error ${formatProblem(problem)}`);
        output.error("refused: nothing written; fix the problems above");
        return;
      }
      for (const change of run.changes) {
        output.log(`${change.action} ${change.id} ${formatBefore(change)} -> ${change.statusAfter}/${change.slug}`);
        if (change.previousSlug !== null) output.log(`moved ${change.id} ${change.previousSlug} -> ${change.slug}`);
        if (change.imported !== undefined) {
          output.log(`imported ${change.id} published_at=${formatDate(change.imported.publishedAt)} old_slugs=${String(change.imported.oldSlugs)}`);
        }
      }
      const counts = countActions(run);
      output.log(`summary: added ${String(counts.added)}, changed ${String(counts.changed)}, unchanged ${String(counts.unchanged)}`);
      output.log(run.committed ? "written" : "dry run: nothing written; pass --commit to write");
    },
    refresh: (outcome) => {
      switch (outcome.kind) {
        case "not_configured":
          output.log(`cache: the running app shows the change within revalidateSeconds (${String(outcome.revalidateSeconds)} s); set ${BLOG_REFRESH_SECRET_ENV} to refresh it now`);
          return;
        case "skipped":
          output.log("cache: no text changed, nothing to refresh");
          return;
        case "dry_run":
          output.log(`cache: dry run, a commit would refresh ${outcome.url}`);
          return;
        case "refreshed":
          output.log(`cache: refreshed ${outcome.url}`);
          return;
        case "failed":
          output.error(`warning cache: ${outcome.reason} (${outcome.code}); the publish is written, the app shows it within ${String(outcome.revalidateSeconds)} s`);
          return;
      }
    },
    indexNow: ({ paths, outcome }) => {
      switch (outcome.kind) {
        case "not_configured":
          output.log(`indexnow: off, ${outcome.reason}`);
          return;
        case "skipped":
          output.log("indexnow: no public address changed, nothing to submit");
          return;
        case "dry_run":
          output.log(`indexnow: dry run, a commit would submit ${String(outcome.urls.length)} URL(s): ${outcome.urls.join(" ")}`);
          return;
        case "submitted":
          output.log(`indexnow: submitted ${String(outcome.count)} URL(s) (${String(outcome.status)}): ${paths.join(" ")}`);
          return;
        case "failed":
          output.error(`warning indexnow: ${outcome.reason} (${outcome.code}); the publish is written, submit the addresses later: ${paths.join(" ")}`);
          return;
      }
    },
  };
}

/** A value inside a contract line: no field separator, no line break. */
function toField(value: string | number): string {
  return String(value).replace(/[|\r\n]+/g, " ");
}

function createLineReporter(output: CliOutput): PublishReporter {
  // Every contract line goes to standard output, so `2>&1` is not needed to read them.
  const line = (...fields: readonly (string | number)[]) => output.log(["blog", ...fields.map(toField)].join("|"));
  return {
    failed: (message) => line("failed", message),
    run: (run) => {
      for (const warning of run.warnings) line("warning", warning.subject, warning.message);
      if (run.status === "refused") {
        for (const problem of run.problems) line("error", problem.subject, problem.message);
        line("refused");
        return;
      }
      for (const change of run.changes) {
        line("change", change.action, change.id, formatBefore(change), `${change.statusAfter}/${change.slug}`);
        if (change.previousSlug !== null) line("moved", change.id, change.previousSlug, change.slug);
        if (change.imported !== undefined) line("imported", change.id, formatDate(change.imported.publishedAt), change.imported.oldSlugs);
      }
      const counts = countActions(run);
      line("summary", counts.added, counts.changed, counts.unchanged);
      line(run.committed ? "written" : "dry-run");
    },
    refresh: (outcome) => {
      switch (outcome.kind) {
        case "not_configured":
          line("cache", "off", outcome.revalidateSeconds);
          return;
        case "skipped":
          line("cache", "skipped");
          return;
        case "dry_run":
          line("cache", "dry-run", outcome.url);
          return;
        case "refreshed":
          line("cache", "refreshed", outcome.url);
          return;
        case "failed":
          line("cache", "failed", outcome.code, outcome.reason);
          return;
      }
    },
    indexNow: ({ paths, outcome }) => {
      switch (outcome.kind) {
        case "not_configured":
          line("indexnow", "off", outcome.reason);
          return;
        case "skipped":
          line("indexnow", "skipped");
          return;
        case "dry_run":
          line("indexnow", "dry-run", outcome.urls.length, outcome.urls.join(" "));
          return;
        case "submitted":
          line("indexnow", "submitted", outcome.count, outcome.status, paths.join(" "));
          return;
        case "failed":
          line("indexnow", "failed", outcome.code, outcome.reason, paths.join(" "));
          return;
      }
    },
  };
}
