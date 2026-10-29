import { writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { DEFAULT_CHANGELOG_ROADMAPS, readChangelog } from "../notes/changelog.js";
import { fail, USAGE_EXIT_CODE } from "./failure.js";
import type { CliIo } from "./io.js";
import { readFlags } from "./options.js";

const MAX_ROADMAPS = 50;

/**
 * `softure-deploy changelog [--roadmaps=2] [--out=<file>]`: the finished items (`done`, `done_code`) of the open
 * roadmap and the newest archived ones as JSON, for the build to embed and the build info route to answer. Without
 * `--out` it prints the JSON.
 */
export function runChangelog(args: string[], io: CliIo): void {
  const flags = readFlags("changelog", args, { roadmaps: { type: "string" }, out: { type: "string" } });
  const limit = flags.roadmaps === undefined ? DEFAULT_CHANGELOG_ROADMAPS : Number(flags.roadmaps);
  if (!/^\d+$/.test(flags.roadmaps ?? "1") || !(limit >= 1 && limit <= MAX_ROADMAPS)) {
    fail(`changelog: --roadmaps must be a whole number from 1 to ${MAX_ROADMAPS}.`, USAGE_EXIT_CODE);
  }
  const changelog = readChangelog(io.cwd, limit);
  const json = `${JSON.stringify(changelog, null, 2)}\n`;
  if (flags.out === undefined) {
    io.stdout(json);
    return;
  }
  writeFileSync(resolve(io.cwd, flags.out), json);
  const items = changelog.reduce((sum, roadmap) => sum + roadmap.items.length, 0);
  io.stdout(`changelog: ${items} finished items of ${changelog.length} roadmaps written to ${flags.out}.\n`);
}
