import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { DEPLOY_LOCALES, getDeployMessages, isDeployLocale } from "../messages/index.js";
import { findPreviousTag, getCommitDate, isSafeRef, readReleaseCommits, resolveCommit } from "../notes/git.js";
import { writeReleaseSection } from "../notes/release-body.js";
import { toReleaseEntries } from "../notes/release-entries.js";
import { formatReleaseNotes } from "../notes/release-notes.js";
import { parseRoadmapItems, selectShippingItems, type RoadmapItem } from "../notes/roadmap-items.js";
import { fail, USAGE_EXIT_CODE } from "./failure.js";
import type { CliIo } from "./io.js";
import { readFlags } from "./options.js";

const REPO_URL = /^https:\/\/[A-Za-z0-9.-]+(?::\d+)?\/[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/;

function checkRef(flag: string, ref: string, cwd: string): string {
  if (!isSafeRef(ref)) fail(`release-notes: --${flag} ${JSON.stringify(ref)} is not a tag or commit name.`, USAGE_EXIT_CODE);
  if (resolveCommit(cwd, ref) === null) fail(`release-notes: --${flag} ${ref} names no commit in ${cwd}.`);
  return ref;
}

/** `--repo-url`, else the repository of the GitHub Actions run, else none (the report goes without links). */
function getRepoUrl(flag: string | undefined, env: CliIo["env"]): string | null {
  const fromActions =
    env.GITHUB_SERVER_URL && env.GITHUB_REPOSITORY ? `${env.GITHUB_SERVER_URL}/${env.GITHUB_REPOSITORY}` : undefined;
  const url = (flag ?? fromActions)?.replace(/\/+$/, "");
  if (url === undefined) return null;
  if (!REPO_URL.test(url)) fail(`release-notes: ${url} is not an https://<host>/<owner>/<repo> URL.`, USAGE_EXIT_CODE);
  return url;
}

function readText(path: string, shown: string): string {
  try {
    return readFileSync(path, "utf8");
  } catch (error) {
    return fail(`release-notes: cannot read ${shown} (${(error as NodeJS.ErrnoException).code ?? "unknown error"}).`);
  }
}

/** The `done_code` items of `--roadmap`; a missing file fails, since the caller asked for the table. */
function readShippingItems(flag: string | undefined, cwd: string): RoadmapItem[] {
  if (flag === undefined) return [];
  return selectShippingItems(parseRoadmapItems(readText(resolve(cwd, flag), flag)));
}

/** The current release body of `--body`; a file that does not exist yet is an empty body (a first run). */
function readBody(flag: string | undefined, cwd: string): string | null {
  if (flag === undefined) return null;
  const path = resolve(cwd, flag);
  return existsSync(path) ? readText(path, flag) : "";
}

/**
 * `softure-deploy release-notes [--to=HEAD] [--from=<tag>] [--match=*] [--repo-url=…] [--locale=en] [--out=…]`:
 * the release report between two tags, from first-parent commits (one per merged pull request). `--roadmap=<file>`
 * adds the roadmap's `done_code` items; `--body=<file>` writes the report into its section of that release body,
 * keeping the text around it.
 */
export function runReleaseNotes(args: string[], io: CliIo): void {
  const flags = readFlags("release-notes", args, {
    from: { type: "string" },
    to: { type: "string", default: "HEAD" },
    match: { type: "string", default: "*" },
    "repo-url": { type: "string" },
    locale: { type: "string", default: "en" },
    out: { type: "string" },
    body: { type: "string" },
    roadmap: { type: "string" },
  });
  if (!isDeployLocale(flags.locale)) {
    fail(`release-notes: --locale must be one of ${DEPLOY_LOCALES.join(", ")}.`, USAGE_EXIT_CODE);
  }
  const repoUrl = getRepoUrl(flags["repo-url"], io.env);
  const to = checkRef("to", flags.to, io.cwd);
  const from =
    flags.from === undefined ? findPreviousTag({ cwd: io.cwd, to, match: flags.match }) : checkRef("from", flags.from, io.cwd);
  const roadmapItems = readShippingItems(flags.roadmap, io.cwd);
  const body = readBody(flags.body, io.cwd);
  const report = formatReleaseNotes({
    entries: toReleaseEntries(readReleaseCommits({ cwd: io.cwd, from, to })),
    from,
    to,
    date: getCommitDate(io.cwd, to),
    repoUrl,
    messages: getDeployMessages(flags.locale),
    roadmapItems,
  });
  const notes = body === null ? report : writeReleaseSection(body, report);
  if (flags.out === undefined) {
    io.stdout(notes);
    return;
  }
  writeFileSync(resolve(io.cwd, flags.out), notes);
  io.stdout(`release-notes: ${from ?? "first commit"}...${to} written to ${flags.out}\n`);
}
