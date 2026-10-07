// `softure-blog`: publishes the app's article files into the module's tables. The app passes its
// validated config, so the same function serves the bin and an app script that a bundler packs
// for a container:
//
//   // scripts/blog.ts
//   import { runBlogCli } from "@softure-ai/blog/cli";
//   import config from "../softure.config";
//   process.exitCode = await runBlogCli({ config, argv: process.argv.slice(2) });
import { mkdir, readdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import { basename, dirname, join, relative, resolve } from "node:path";
import { parseArgs } from "node:util";
import { systemClock, type Clock, type SoftureConfig, type SoftureDatabaseConfig } from "@softure-ai/core";
import { openCommandDatabase, type CommandDatabase, type DatabaseHandle } from "@softure-ai/db";
import { BLOG_REFRESH_SECRET_ENV, requestBlogRefresh, type BlogRefreshOutcome } from "../discovery/refresh.js";
import { submitBlogChanges, type BlogIndexNowSubmit } from "../discovery/submit.js";
import { runBlogPublish, type ArticleFile, type BlogPublishRun, type PublishedChange, type PublishGate, type PublishProblem } from "../db/publish-run.js";
import { checkArticleFiles, type FileCheckResult } from "../quality/check-files.js";
import type { FetchLike } from "../quality/external-links.js";
import { createQualityGate } from "../quality/gate.js";
import { createInternalLinkResolver, findAppDir, readContentFolder, readGlossaryTerms, readPublishedContent } from "../quality/link-targets.js";
import { getLocalDate } from "../quality/settings.js";
import type { OgFontSource } from "../options.js";
import { createOgFontLoader } from "../server/og-fonts.js";
import { getBlogOptions, getBlogReservedSlugs, getQualitySettings } from "../server/options.js";
import { DEFAULT_SKILL_COMMAND, DEFAULT_SKILL_DIR, renderBlogSkill, SKILL_MARKER, type SkillFile } from "./skill.js";

export interface CliOutput {
  readonly log: (line: string) => void;
  readonly error: (line: string) => void;
}

export interface RunBlogCliOptions {
  /** The app's config with `blog()` among its modules. */
  readonly config: SoftureConfig;
  /** The arguments after the executable, e.g. `["publish", "content/blog", "--commit"]`. */
  readonly argv: readonly string[];
  /** Relative paths resolve against it. Default: `process.cwd()`. */
  readonly cwd?: string;
  readonly output?: CliOutput;
  /** Opens the database connection. Default: the config's `database.handle`, else `createDatabase(url, { max: 1 })`. */
  readonly openDatabase?: (url: string) => Promise<DatabaseHandle>;
  /** The gate for files going public. Default: the quality gate of `blog({ quality })`, none with `quality: false`. */
  readonly gate?: PublishGate;
  readonly clock?: Clock;
  /** For `check --external`. Default: the global `fetch`. */
  readonly fetch?: FetchLike;
  /** For `check` reading the https sources of `brand.fonts`. Default: the global `fetch`. */
  readonly fontFetch?: typeof fetch;
  /** For the IndexNow submit after `publish`. Default: the global `fetch`. */
  readonly indexNowFetch?: typeof fetch;
  /** For the cache refresh request after `publish`. Default: the global `fetch`. */
  readonly refreshFetch?: typeof fetch;
  /** Where `publish` reads BLOG_REFRESH_SECRET. Default: `process.env`. */
  readonly env?: Readonly<Record<string, string | undefined>>;
}

export const EXIT_OK = 0;
export const EXIT_FAILED = 1;
export const EXIT_USAGE = 2;

export const BLOG_USAGE = `Usage:
  softure-blog publish [<path>...] [--commit] [--withdraw] [--no-indexnow] [--app-url <origin>]
  softure-blog check [<path>...] [--external] [--today <YYYY-MM-DD>]
  softure-blog skill install [--dir <path>] [--command <cmd>] [--check]

publish   Brings the blog's tables to the state of the article files. A <path> is a file or a
          folder (every *.md in it except README.md); without one, blog({ contentDir }).
          Every file is checked before the first write, and one problem writes nothing.
  --commit      write the changes; without it, a dry run that shows them and writes nothing
  --withdraw    publish the one given file as withdrawn, whatever its status
  --no-indexnow do not submit the changed addresses to IndexNow
  --app-url     the running app's origin for the cache refresh; default: appOrigin
          Files going public pass the quality gate first; an error writes nothing.
          With ${BLOG_REFRESH_SECRET_ENV} set, a commit that changed a text asks the running
          app (refreshBlogCache) to refresh its blog cache, before the IndexNow submit.
          With seo({ indexNow }) enabled, a commit submits the addresses whose answer
          changed (the text, its old slug, its listing) to IndexNow; a dry run prints them.

check     Runs the quality gate of blog({ quality }) over the files, without a database, and
          prints every finding as file:line: severity [rule] message. Exits 1 on any error.
  --external    also request every external link (2xx after redirects)
  --today       the date to check freshness against; default: today in the app's time zone

skill install
          Writes the article writing skill, filled from blog({ quality, skill }),
          into ${DEFAULT_SKILL_DIR}. Overwrites only a skill it generated before.
  --dir         the skill folder; default ${DEFAULT_SKILL_DIR}
  --command     how the skill runs this command; default "${DEFAULT_SKILL_COMMAND}"
  --check       write nothing; exit 1 when the folder differs from what install would write

Options:
  --config <file>    the app's softure.config file (bin only)
  --help             show this help`;

const consoleOutput: CliOutput = {
  log: (line) => console.log(line),
  error: (line) => console.error(line),
};

export type BlogCommand =
  | { readonly kind: "help" }
  | {
      readonly kind: "publish";
      readonly paths: readonly string[];
      readonly commit: boolean;
      readonly withdraw: boolean;
      readonly indexNow: boolean;
      /** The origin `--app-url` gives; `null`: `appOrigin`. */
      readonly appUrl: string | null;
    }
  | { readonly kind: "check"; readonly paths: readonly string[]; readonly external: boolean; readonly today: string | null }
  | { readonly kind: "skill-install"; readonly dir: string; readonly command: string; readonly check: boolean };

/** Runs the command and returns the process exit code: 0 done, 1 refused or failed, 2 usage error. */
export async function runBlogCli(options: RunBlogCliOptions): Promise<number> {
  const output = options.output ?? consoleOutput;
  const command = parseBlogCommand(options.argv);
  if (typeof command === "string") {
    output.error(`softure-blog: ${command}`);
    output.error(BLOG_USAGE);
    return EXIT_USAGE;
  }
  if (command.kind === "help") {
    output.log(BLOG_USAGE);
    return EXIT_OK;
  }
  if (command.kind === "skill-install") return runSkillInstall(command, options, output);
  return command.kind === "check" ? runCheck(command, options, output) : runPublish(command, options, output);
}

/** The command the arguments name, or why they name none. Reads nothing. */
export function parseBlogCommand(argv: readonly string[]): BlogCommand | string {
  const [name, ...rest] = argv;
  if (name === undefined) return "missing command; use publish, check or skill install";
  if (name === "--help") return { kind: "help" };
  if (name === "check") return parseCheckCommand(rest);
  if (name === "skill") return parseSkillCommand(rest);
  if (name !== "publish") return `unknown command "${name}"; use publish, check or skill install`;

  let parsed: ReturnType<typeof parsePublishArgs>;
  try {
    parsed = parsePublishArgs(rest);
  } catch (error) {
    return error instanceof Error ? error.message : String(error);
  }
  const { values, positionals } = parsed;
  if (values.help === true) return { kind: "help" };
  const withdraw = values.withdraw === true;
  if (withdraw && positionals.length !== 1) return "--withdraw takes exactly one article file";
  const appUrl = values["app-url"] === undefined ? null : parseOrigin(values["app-url"]);
  if (appUrl === undefined) return `--app-url needs an http or https origin, e.g. http://web:3000, not "${values["app-url"] ?? ""}"`;
  return { kind: "publish", paths: positionals, commit: values.commit === true, withdraw, indexNow: values["no-indexnow"] !== true, appUrl };
}

/** The origin of an http(s) URL, or `undefined` for anything else. */
function parseOrigin(value: string): string | undefined {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:" ? url.origin : undefined;
  } catch {
    // The caller names the value.
    return undefined;
  }
}

function parseCheckCommand(args: readonly string[]): BlogCommand | string {
  let parsed: ReturnType<typeof parseCheckArgs>;
  try {
    parsed = parseCheckArgs(args);
  } catch (error) {
    return error instanceof Error ? error.message : String(error);
  }
  const { values, positionals } = parsed;
  if (values.help === true) return { kind: "help" };
  const today = values.today ?? null;
  if (today !== null && (!/^\d{4}-\d{2}-\d{2}$/.test(today) || Number.isNaN(Date.parse(`${today}T00:00:00Z`)))) return `--today needs a date YYYY-MM-DD, not "${today}"`;
  return { kind: "check", paths: positionals, external: values.external === true, today };
}

function parseSkillCommand(args: readonly string[]): BlogCommand | string {
  const [subcommand, ...rest] = args;
  if (subcommand === "--help") return { kind: "help" };
  if (subcommand !== "install") return subcommand === undefined ? "skill needs a subcommand: install" : `unknown skill subcommand "${subcommand}"; use install`;
  let parsed: ReturnType<typeof parseSkillArgs>;
  try {
    parsed = parseSkillArgs(rest);
  } catch (error) {
    return error instanceof Error ? error.message : String(error);
  }
  const { values, positionals } = parsed;
  if (values.help === true) return { kind: "help" };
  if (positionals.length > 0) return `skill install takes no paths; use --dir <path>, not "${positionals.join(" ")}"`;
  const dir = values.dir ?? DEFAULT_SKILL_DIR;
  const command = values.command ?? DEFAULT_SKILL_COMMAND;
  if (dir.trim() === "") return "--dir needs a folder";
  if (command.trim() === "") return "--command needs the command, e.g. \"npm run blog --\"";
  return { kind: "skill-install", dir, command: command.trim(), check: values.check === true };
}

function parseSkillArgs(args: readonly string[]) {
  return parseArgs({
    args: [...args],
    options: {
      dir: { type: "string" },
      command: { type: "string" },
      check: { type: "boolean" },
      help: { type: "boolean" },
    },
    strict: true,
    allowPositionals: true,
  });
}

function parseCheckArgs(args: readonly string[]) {
  return parseArgs({
    args: [...args],
    options: {
      external: { type: "boolean" },
      today: { type: "string" },
      help: { type: "boolean" },
    },
    strict: true,
    allowPositionals: true,
  });
}

function parsePublishArgs(args: readonly string[]) {
  return parseArgs({
    args: [...args],
    options: {
      commit: { type: "boolean" },
      withdraw: { type: "boolean" },
      "no-indexnow": { type: "boolean" },
      "app-url": { type: "string" },
      help: { type: "boolean" },
    },
    strict: true,
    allowPositionals: true,
  });
}

async function runPublish(command: Extract<BlogCommand, { kind: "publish" }>, options: RunBlogCliOptions, output: CliOutput): Promise<number> {
  const cwd = options.cwd ?? process.cwd();
  const { config } = options;
  let blogOptions: ReturnType<typeof getBlogOptions>;
  try {
    blogOptions = getBlogOptions(config);
  } catch (error) {
    output.error(`softure-blog publish: ${describeError(error)}`);
    return EXIT_FAILED;
  }
  const paths = command.paths.length > 0 ? command.paths : [blogOptions.contentDir];
  const files = await readArticleFiles(paths.map((path) => resolve(cwd, path)));
  if (typeof files === "string") {
    output.error(`softure-blog publish: ${files}`);
    return EXIT_FAILED;
  }
  if (command.withdraw && files.length !== 1) {
    output.error("softure-blog publish: --withdraw takes exactly one article file, not a folder");
    return EXIT_FAILED;
  }
  if (config.database === null) {
    output.error("softure-blog publish: the config has no database; set database.url in softure.config");
    return EXIT_FAILED;
  }

  const clock = options.clock ?? systemClock;
  let gate = options.gate;
  if (gate === undefined) {
    const settings = getQualitySettings(config);
    if (settings !== null) gate = createQualityGate(settings, clock);
  }

  let opened: CommandDatabase;
  try {
    opened = await openDatabase(config.database, options.openDatabase);
  } catch (error) {
    output.error(`softure-blog publish: ${describeError(error)}`);
    return EXIT_FAILED;
  }
  try {
    const run = await runBlogPublish(
      { db: opened.handle.db, clock, config },
      files,
      {
        commit: command.commit,
        withdraw: command.withdraw,
        reservedSlugs: getBlogReservedSlugs(config),
        ...(blogOptions.fields === undefined ? {} : { fields: blogOptions.fields }),
        ...(gate === undefined ? {} : { gate }),
      },
    );
    const code = reportRun(run, output);
    if (run.status === "done") {
      // Before the IndexNow submit: a crawler that answers the ping must find the new text.
      const refresh = await requestBlogRefresh(config, run.changes, {
        commit: run.committed,
        ...(command.appUrl === null ? {} : { appUrl: command.appUrl }),
        ...(options.env === undefined ? {} : { env: options.env }),
        ...(options.refreshFetch === undefined ? {} : { fetchImpl: options.refreshFetch }),
      });
      reportRefresh(refresh, output);
    }
    if (run.status === "done" && command.indexNow) {
      reportIndexNow(await submitBlogChanges(config, run.changes, { commit: run.committed, ...(options.indexNowFetch === undefined ? {} : { fetchImpl: options.indexNowFetch }) }), output);
    }
    return code;
  } catch (error) {
    // Driver errors: the message only, never a stack or the database URL.
    output.error(`softure-blog publish: ${describeError(error)} (did softure migrate run?)`);
    return EXIT_FAILED;
  } finally {
    await opened.close();
  }
}

async function runCheck(command: Extract<BlogCommand, { kind: "check" }>, options: RunBlogCliOptions, output: CliOutput): Promise<number> {
  const cwd = options.cwd ?? process.cwd();
  let blogOptions: ReturnType<typeof getBlogOptions>;
  let settings: ReturnType<typeof getQualitySettings>;
  try {
    blogOptions = getBlogOptions(options.config);
    settings = getQualitySettings(options.config);
  } catch (error) {
    output.error(`softure-blog check: ${describeError(error)}`);
    return EXIT_FAILED;
  }
  if (settings === null) {
    output.error("softure-blog check: the quality gate is off (blog({ quality: false })); nothing to check");
    return EXIT_FAILED;
  }
  // The OG card's fonts, read as the card's route reads them (paths from the app's root), so CI
  // reports a source the first card would fail on.
  const fontProblem = await checkBrandFonts(blogOptions.brand?.fonts, cwd, options.fontFetch);
  if (fontProblem !== null) output.error(`softure-blog check: ${fontProblem}`);
  const fontErrors = fontProblem === null ? 0 : 1;
  const contentDir = resolve(cwd, blogOptions.contentDir);
  const paths = command.paths.length > 0 ? command.paths.map((path) => resolve(cwd, path)) : [contentDir];
  const files = await readArticleFiles(paths);
  if (typeof files === "string") {
    output.error(`softure-blog check: ${files}`);
    return EXIT_FAILED;
  }
  if (files.length === 0) {
    output.log("check: no article files");
    return fontErrors > 0 ? EXIT_FAILED : EXIT_OK;
  }

  // Link targets and glossary forms: the published texts of the content folder and of the checked files, and the app's routes.
  const siteFiles = [...readContentFolder(contentDir), ...files];
  const content = readPublishedContent(siteFiles);
  const parse = { reservedSlugs: getBlogReservedSlugs(options.config), ...(blogOptions.fields === undefined ? {} : { fields: blogOptions.fields }) };
  const resolveInternalLink = createInternalLinkResolver({
    appDir: findAppDir(cwd, settings.options.appDir),
    privateRouteSegments: settings.options.privateRouteSegments,
    paths: settings.options.paths,
    content,
  });
  const results = await checkArticleFiles(files, {
    settings,
    today: command.today ?? getLocalDate((options.clock ?? systemClock).now(), settings.timeZone),
    resolveInternalLink,
    parse,
    glossary: readGlossaryTerms(siteFiles, parse),
    ...(command.external ? { fetch: options.fetch ?? fetch } : {}),
  });
  return reportCheck(results, files, cwd, output, fontErrors);
}

/** The loader's message for a `brand.fonts` source the card cannot read; `null` when every one reads or none is set. */
async function checkBrandFonts(fonts: readonly OgFontSource[] | undefined, root: string, fetchImpl: typeof fetch | undefined): Promise<string | null> {
  if (fonts === undefined) return null;
  const loaded = await createOgFontLoader({ root, ...(fetchImpl === undefined ? {} : { fetchImpl }) })(fonts);
  return loaded.ok ? null : loaded.error;
}

async function runSkillInstall(command: Extract<BlogCommand, { kind: "skill-install" }>, options: RunBlogCliOptions, output: CliOutput): Promise<number> {
  const cwd = options.cwd ?? process.cwd();
  const dir = resolve(cwd, command.dir);
  const shown = relative(cwd, dir) || ".";
  let files: SkillFile[];
  try {
    files = renderBlogSkill(options.config, { command: command.command });
  } catch (error) {
    output.error(`softure-blog skill install: ${describeError(error)}`);
    return EXIT_FAILED;
  }

  let extra: string[];
  try {
    const rendered = new Set(files.map((file) => file.path));
    extra = (await listMarkdownFiles(dir)).filter((path) => !rendered.has(path));
  } catch (error) {
    output.error(`softure-blog skill install: cannot read ${shown}: ${describeError(error)}`);
    return EXIT_FAILED;
  }

  if (command.check) {
    const stale: string[] = [];
    for (const file of files) {
      if ((await readText(join(dir, file.path))) !== file.text) stale.push(file.path);
    }
    if (stale.length === 0 && extra.length === 0) {
      output.log(`skill: ${shown} is up to date`);
      return EXIT_OK;
    }
    for (const path of stale) output.error(`skill: ${join(shown, path)} differs from the blog config`);
    for (const path of extra) output.error(`skill: ${join(shown, path)} is not part of the skill`);
    output.error("skill: run softure-blog skill install with the same options and commit the folder");
    return EXIT_FAILED;
  }

  const existing = await readText(join(dir, "SKILL.md"));
  if (existing !== null && !existing.includes(SKILL_MARKER)) {
    output.error(`softure-blog skill install: ${join(shown, "SKILL.md")} was not generated by this command; refusing to overwrite it (choose another --dir)`);
    return EXIT_FAILED;
  }
  try {
    for (const file of files) {
      const path = join(dir, file.path);
      await mkdir(dirname(path), { recursive: true });
      await writeFile(path, file.text, "utf8");
    }
    // The folder is the command's own (its SKILL.md carries the marker): a Markdown file it no longer renders goes.
    for (const path of extra) await rm(join(dir, path));
  } catch (error) {
    output.error(`softure-blog skill install: cannot write ${shown}: ${describeError(error)}`);
    return EXIT_FAILED;
  }
  for (const file of files) output.log(`wrote ${join(shown, file.path)}`);
  for (const path of extra) output.log(`removed ${join(shown, path)}`);
  output.log(`skill: installed into ${shown}; commit it, and run skill install --check in CI`);
  return EXIT_OK;
}

/** `configErrors`: problems of the config itself (the brand's fonts), already printed. */
function reportCheck(results: readonly FileCheckResult[], files: readonly ReadArticleFile[], cwd: string, output: CliOutput, configErrors: number): number {
  let errors = configErrors;
  let warnings = 0;
  for (const [index, result] of results.entries()) {
    const shown = relative(cwd, files[index]?.path ?? result.file) || result.file;
    if (result.findings.length === 0) output.log(`${shown}: OK`);
    for (const finding of result.findings) {
      output.log(`${finding.line === undefined ? shown : `${shown}:${String(finding.line)}`}: ${finding.severity} [${finding.rule}] ${finding.message}`);
      if (finding.severity === "error") errors += 1;
      else warnings += 1;
    }
  }
  output.log(`check: ${String(results.length)} file(s), ${String(errors)} error(s), ${String(warnings)} warning(s): ${errors > 0 ? "red, do not publish" : "green"}`);
  return errors > 0 ? EXIT_FAILED : EXIT_OK;
}

function reportRun(run: BlogPublishRun, output: CliOutput): number {
  for (const warning of run.warnings) output.error(`warning ${formatProblem(warning)}`);
  if (run.status === "refused") {
    for (const problem of run.problems) output.error(`error ${formatProblem(problem)}`);
    output.error("refused: nothing written; fix the problems above");
    return EXIT_FAILED;
  }
  for (const change of run.changes) {
    output.log(formatChange(change));
    if (change.previousSlug !== null) output.log(`moved ${change.id} ${change.previousSlug} -> ${change.slug}`);
  }
  const count = (action: PublishedChange["action"]) => String(run.changes.filter((change) => change.action === action).length);
  output.log(`summary: added ${count("added")}, changed ${count("changed")}, unchanged ${count("unchanged")}`);
  output.log(run.committed ? "written" : "dry run: nothing written; pass --commit to write");
  return EXIT_OK;
}

/** One line about the cache refresh; a failure is a warning and never changes the exit code. */
function reportRefresh(outcome: BlogRefreshOutcome, output: CliOutput): void {
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
}

/** One line about the IndexNow submit; a failure is a warning and never changes the exit code. */
function reportIndexNow({ paths, outcome }: BlogIndexNowSubmit, output: CliOutput): void {
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
}

function formatChange(change: PublishedChange): string {
  const before = change.statusBefore === null || change.slugBefore === null ? "none" : `${change.statusBefore}/${change.slugBefore}`;
  return `${change.action} ${change.id} ${before} -> ${change.statusAfter}/${change.slug}`;
}

function formatProblem(problem: PublishProblem): string {
  return `${problem.subject}: ${problem.message}`;
}

interface ReadArticleFile extends ArticleFile {
  readonly path: string;
}

/** The files the paths name, sorted by name within a folder, or why they cannot be read. */
async function readArticleFiles(paths: readonly string[]): Promise<ReadArticleFile[] | string> {
  const files: ReadArticleFile[] = [];
  for (const path of paths) {
    const kind = await getPathKind(path);
    if (kind === null) return `cannot read ${path}`;
    const filePaths =
      kind === "file"
        ? [path]
        : (await readdir(path))
            .filter((name) => name.endsWith(".md") && name !== "README.md")
            .sort()
            .map((name) => join(path, name));
    for (const filePath of filePaths) {
      const text = await readText(filePath);
      if (text === null) return `cannot read ${filePath}`;
      files.push({ name: basename(filePath), text, path: filePath });
    }
  }
  return files;
}

async function getPathKind(path: string): Promise<"file" | "folder" | null> {
  try {
    const stats = await stat(path);
    return stats.isDirectory() ? "folder" : "file";
  } catch {
    // The caller names the path; the error code adds nothing an editor can act on.
    return null;
  }
}

/** The `.md` files under `dir`, relative to it with `/`; none when the folder does not exist. */
async function listMarkdownFiles(dir: string): Promise<string[]> {
  let entries: string[];
  try {
    entries = await readdir(dir, { recursive: true });
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") return [];
    throw error;
  }
  return entries
    .map((entry) => entry.split("\\").join("/"))
    .filter((entry) => entry.endsWith(".md"))
    .sort();
}

async function readText(path: string): Promise<string | null> {
  try {
    return await readFile(path, "utf8");
  } catch {
    // The caller names the path.
    return null;
  }
}

async function openDatabase(database: SoftureDatabaseConfig, open: ((url: string) => Promise<DatabaseHandle>) | undefined): Promise<CommandDatabase> {
  if (open === undefined) return openCommandDatabase(database, { max: 1 });
  const handle = await open(database.url);
  return { handle, close: handle.close };
}

/** The driver's own message; drizzle's "Failed query: … params: …" wrapper is dropped. */
function describeError(error: unknown): string {
  if (!(error instanceof Error)) return String(error);
  return error.cause instanceof Error ? error.cause.message : error.message;
}
