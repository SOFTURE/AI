import { writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { DEFAULT_CHANGELOG_ROADMAPS, readChangelog } from "../notes/changelog.js";
import { fail, USAGE_EXIT_CODE } from "./failure.js";
import type { CliIo } from "./io.js";
import { readFlags } from "./options.js";

const MAX_ROADMAPS = 50;
const MAX_FIELDS = 10;
const COLUMN_NAME = /^[A-Za-z0-9][A-Za-z0-9 _.-]{0,39}$/;

/** `--fields=Findings,Area`: roadmap column names, comma-separated, each at most once. */
function readFields(text: string | undefined): string[] {
  if (text === undefined) return [];
  const names = text.split(",").map((name) => name.trim());
  if (names.length > MAX_FIELDS) fail(`changelog: --fields names at most ${MAX_FIELDS} columns.`, USAGE_EXIT_CODE);
  for (const name of names) {
    if (!COLUMN_NAME.test(name)) {
      fail(`changelog: --fields ${JSON.stringify(name)} is not a column name (letters, digits, space, _ . -; at most 40).`, USAGE_EXIT_CODE);
    }
  }
  const lower = names.map((name) => name.toLowerCase());
  if (new Set(lower).size !== lower.length) fail("changelog: --fields names a column twice.", USAGE_EXIT_CODE);
  return names;
}

/**
 * `softure-deploy changelog [--roadmaps=2] [--fields=<column>,...] [--out=<file>]`: the finished items (`done`,
 * `done_code`) of the open roadmap and the newest archived ones as JSON, for the build to embed and the build info
 * route to answer; `--fields` copies more roadmap columns into each item's `fields`. Without `--out` it prints the JSON.
 */
export function runChangelog(args: string[], io: CliIo): void {
  const flags = readFlags("changelog", args, { roadmaps: { type: "string" }, fields: { type: "string" }, out: { type: "string" } });
  const limit = flags.roadmaps === undefined ? DEFAULT_CHANGELOG_ROADMAPS : Number(flags.roadmaps);
  if (!/^\d+$/.test(flags.roadmaps ?? "1") || !(limit >= 1 && limit <= MAX_ROADMAPS)) {
    fail(`changelog: --roadmaps must be a whole number from 1 to ${MAX_ROADMAPS}.`, USAGE_EXIT_CODE);
  }
  const changelog = readChangelog(io.cwd, limit, readFields(flags.fields));
  const json = `${JSON.stringify(changelog, null, 2)}\n`;
  if (flags.out === undefined) {
    io.stdout(json);
    return;
  }
  writeFileSync(resolve(io.cwd, flags.out), json);
  const items = changelog.reduce((sum, roadmap) => sum + roadmap.items.length, 0);
  io.stdout(`changelog: ${items} finished items of ${changelog.length} roadmaps written to ${flags.out}.\n`);
}
