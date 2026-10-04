// `softure-blog`: publishes the app's article files into the module's tables. The app passes its
// validated config, so the same function serves the bin and an app script that a bundler packs
// for a container:
//
//   // scripts/blog.ts
//   import { runBlogCli } from "@softure-ai/blog/cli";
//   import config from "../softure.config";
//   process.exitCode = await runBlogCli({ config, argv: process.argv.slice(2) });
import { readdir, readFile, stat } from "node:fs/promises";
import { basename, join, resolve } from "node:path";
import { parseArgs } from "node:util";
import { systemClock, type Clock, type SoftureConfig } from "@softure-ai/core";
import { createDatabase, type DatabaseHandle } from "@softure-ai/db";
import { runBlogPublish, type ArticleFile, type BlogPublishRun, type PublishedChange, type PublishGate, type PublishProblem } from "../db/publish-run.js";
import { getBlogOptions, getBlogReservedSlugs } from "../server/options.js";

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
  /** Opens the database connection. Default: `createDatabase(url, { max: 1 })`. */
  readonly openDatabase?: (url: string) => Promise<DatabaseHandle>;
  /** The quality gate for files going public (BL-6). Default: none. */
  readonly gate?: PublishGate;
  readonly clock?: Clock;
}

export const EXIT_OK = 0;
export const EXIT_FAILED = 1;
export const EXIT_USAGE = 2;

export const BLOG_USAGE = `Usage:
  softure-blog publish [<path>...] [--commit] [--withdraw]

publish   Brings the blog's tables to the state of the article files. A <path> is a file or a
          folder (every *.md in it except README.md); without one, blog({ contentDir }).
          Every file is checked before the first write, and one problem writes nothing.
  --commit      write the changes; without it, a dry run that shows them and writes nothing
  --withdraw    publish the one given file as withdrawn, whatever its status

Options:
  --config <file>    the app's softure.config file (bin only)
  --help             show this help`;

const consoleOutput: CliOutput = {
  log: (line) => console.log(line),
  error: (line) => console.error(line),
};

export type BlogCommand = { readonly kind: "help" } | { readonly kind: "publish"; readonly paths: readonly string[]; readonly commit: boolean; readonly withdraw: boolean };

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
  return runPublish(command, options, output);
}

/** The command the arguments name, or why they name none. Reads nothing. */
export function parseBlogCommand(argv: readonly string[]): BlogCommand | string {
  const [name, ...rest] = argv;
  if (name === undefined) return "missing command; use publish";
  if (name === "--help") return { kind: "help" };
  if (name !== "publish") return `unknown command "${name}"; use publish`;

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
  return { kind: "publish", paths: positionals, commit: values.commit === true, withdraw };
}

function parsePublishArgs(args: readonly string[]) {
  return parseArgs({
    args: [...args],
    options: {
      commit: { type: "boolean" },
      withdraw: { type: "boolean" },
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

  let handle: DatabaseHandle;
  try {
    handle = await (options.openDatabase ?? openDatabase)(config.database.url);
  } catch (error) {
    output.error(`softure-blog publish: ${describeError(error)}`);
    return EXIT_FAILED;
  }
  try {
    const run = await runBlogPublish(
      { db: handle.db, clock: options.clock ?? systemClock, config },
      files,
      {
        commit: command.commit,
        withdraw: command.withdraw,
        reservedSlugs: getBlogReservedSlugs(config),
        ...(blogOptions.fields === undefined ? {} : { fields: blogOptions.fields }),
        ...(options.gate === undefined ? {} : { gate: options.gate }),
      },
    );
    return reportRun(run, output);
  } catch (error) {
    // Driver errors: the message only, never a stack or the database URL.
    output.error(`softure-blog publish: ${describeError(error)} (did softure migrate run?)`);
    return EXIT_FAILED;
  } finally {
    await handle.close();
  }
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

function formatChange(change: PublishedChange): string {
  const before = change.statusBefore === null || change.slugBefore === null ? "none" : `${change.statusBefore}/${change.slugBefore}`;
  return `${change.action} ${change.id} ${before} -> ${change.statusAfter}/${change.slug}`;
}

function formatProblem(problem: PublishProblem): string {
  return `${problem.subject}: ${problem.message}`;
}

/** The files the paths name, sorted by name within a folder, or why they cannot be read. */
async function readArticleFiles(paths: readonly string[]): Promise<ArticleFile[] | string> {
  const files: ArticleFile[] = [];
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
      files.push({ name: basename(filePath), text });
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

async function readText(path: string): Promise<string | null> {
  try {
    return await readFile(path, "utf8");
  } catch {
    // The caller names the path.
    return null;
  }
}

function openDatabase(url: string): Promise<DatabaseHandle> {
  return createDatabase(url, { max: 1 });
}

/** The driver's own message; drizzle's "Failed query: … params: …" wrapper is dropped. */
function describeError(error: unknown): string {
  if (!(error instanceof Error)) return String(error);
  return error.cause instanceof Error ? error.cause.message : error.message;
}
