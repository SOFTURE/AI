// `softure migrate` (docs/02-module-standard.md §4). The app passes its validated config, so the
// same function serves the `softure` bin and an app script that esbuild bundles for a container:
//
//   // scripts/migrate.ts
//   import { runMigrateCli } from "@softure-ai/db/cli";
//   import config from "../softure.config";
//   process.exitCode = await runMigrateCli({ config, argv: process.argv.slice(2) });
import { resolve } from "node:path";
import { parseArgs } from "node:util";
import { pathToFileURL } from "node:url";
import type { SoftureConfig } from "@softure-ai/core";
import { createDatabase, type DatabaseHandle } from "../client.js";
import { adoptModule } from "../migrations/adopt.js";
import { exportMigrations } from "../migrations/export.js";
import { migrate, planMigrations, type MigrationStep } from "../migrations/migrator.js";
import { describeProblem, type MigrationFailure } from "../migrations/problems.js";

export interface CliOutput {
  readonly log: (line: string) => void;
  readonly error: (line: string) => void;
}

export interface RunMigrateCliOptions {
  readonly config: Pick<SoftureConfig, "database" | "modules">;
  /** The arguments after the command name, e.g. `["--plan"]`. */
  readonly argv: readonly string[];
  /** Relative paths resolve against it. Default: `process.cwd()`. */
  readonly cwd?: string;
  readonly output?: CliOutput;
}

export const EXIT_OK = 0;
export const EXIT_FAILED = 1;
export const EXIT_USAGE = 2;

export const MIGRATE_USAGE = `Usage: softure migrate [options]

Applies the SQL migrations of every enabled module, each in its own schema.

Options:
  --plan                        show what would be applied (or adopted) and change nothing
  --adopt <module>@<version>    record an existing schema as migrated, after comparing it
  --migrations-dir <dir>        read module files from <dir>/<module id>/ (bundled runners)
  --export-migrations <dir>     copy module files to <dir>/<module id>/ and exit (build stage)
  --help                        show this help`;

const ADOPT_TARGET = /^([a-z][a-z0-9]*(?:-[a-z0-9]+)*)@(\d+\.\d+\.\d+)$/;

const consoleOutput: CliOutput = {
  log: (line) => console.log(line),
  error: (line) => console.error(line),
};

type Command =
  | { kind: "help" }
  | { kind: "export"; targetDir: string }
  | { kind: "migrate"; plan: boolean; migrationsDir: string | undefined }
  | { kind: "adopt"; plan: boolean; module: string; version: string; migrationsDir: string | undefined };

/** Runs the command and returns the process exit code: 0 done, 1 failed, 2 usage error. */
export async function runMigrateCli(options: RunMigrateCliOptions): Promise<number> {
  const output = options.output ?? consoleOutput;
  const cwd = options.cwd ?? process.cwd();
  const command = parseCommand(options.argv);
  if (typeof command === "string") {
    output.error(`softure migrate: ${command}`);
    output.error(MIGRATE_USAGE);
    return EXIT_USAGE;
  }
  if (command.kind === "help") {
    output.log(MIGRATE_USAGE);
    return EXIT_OK;
  }
  if (command.kind === "export") {
    const result = await exportMigrations(options.config.modules, resolve(cwd, command.targetDir));
    if (!result.ok) return reportFailure(output, result);
    result.value.forEach((step) => output.log(`exported ${formatStep(step)}`));
    return EXIT_OK;
  }

  const url = options.config.database?.url;
  if (url === undefined) {
    output.error("softure migrate: the config has no database; set database.url in softure.config");
    return EXIT_FAILED;
  }
  let handle: DatabaseHandle;
  try {
    handle = await createDatabase(url);
  } catch (error) {
    output.error(`softure migrate: ${describeError(error)}`);
    return EXIT_FAILED;
  }
  try {
    const migrationsDir = command.migrationsDir === undefined ? undefined : pathToFileURL(`${resolve(cwd, command.migrationsDir)}/`);
    return await runDatabaseCommand(handle, { command, modules: options.config.modules, migrationsDir, output });
  } catch (error) {
    // Connection and driver errors: the message only, never a stack or the database URL.
    output.error(`softure migrate: ${describeError(error)}`);
    return EXIT_FAILED;
  } finally {
    await handle.close();
  }
}

async function runDatabaseCommand(
  handle: DatabaseHandle,
  input: {
    command: Extract<Command, { kind: "migrate" | "adopt" }>;
    modules: RunMigrateCliOptions["config"]["modules"];
    migrationsDir: URL | undefined;
    output: CliOutput;
  },
): Promise<number> {
  const { command, modules, output } = input;
  const dirOption = input.migrationsDir === undefined ? {} : { migrationsDir: input.migrationsDir };

  if (command.kind === "adopt") {
    const result = await adoptModule(handle, { modules, module: command.module, version: command.version, dryRun: command.plan, ...dirOption });
    if (!result.ok) return reportFailure(output, result);
    const verb = command.plan ? "would" : "did";
    result.value.ledger.forEach((step) => output.log(`${verb} apply ${formatStep(step)}`));
    result.value.adopted.forEach((step) => output.log(`${verb} adopt ${formatStep(step)}`));
    output.log(`${command.module}@${command.version}: the schema matches its migrations${command.plan ? " (plan only, nothing written)" : "; adopted"}`);
    return EXIT_OK;
  }

  if (command.plan) {
    const result = await planMigrations(handle, { modules, ...dirOption });
    if (!result.ok) return reportFailure(output, result);
    result.value.pending.forEach((step) => output.log(`pending ${formatStep(step)}`));
    output.log(result.value.pending.length === 0 ? "nothing to apply" : `${result.value.pending.length} migration(s) to apply`);
    return EXIT_OK;
  }

  const result = await migrate(handle, { modules, ...dirOption, onApplied: (step) => output.log(`applied ${formatStep(step)}`) });
  if (!result.ok) return reportFailure(output, result);
  output.log(result.value.applied.length === 0 ? "nothing to apply" : `${result.value.applied.length} migration(s) applied`);
  return EXIT_OK;
}

function parseCommand(argv: readonly string[]): Command | string {
  let values: { plan?: boolean; adopt?: string; "migrations-dir"?: string; "export-migrations"?: string; help?: boolean };
  try {
    ({ values } = parseArgs({
      args: [...argv],
      options: {
        plan: { type: "boolean" },
        adopt: { type: "string" },
        "migrations-dir": { type: "string" },
        "export-migrations": { type: "string" },
        help: { type: "boolean" },
      },
      strict: true,
      allowPositionals: false,
    }));
  } catch (error) {
    return describeError(error);
  }

  if (values.help === true) return { kind: "help" };
  const exportDir = values["export-migrations"];
  if (exportDir !== undefined) {
    const others = (["plan", "adopt", "migrations-dir"] as const).filter((name) => values[name] !== undefined);
    return others.length > 0 ? `--export-migrations cannot be combined with --${others.join(", --")}` : { kind: "export", targetDir: exportDir };
  }
  const plan = values.plan === true;
  const migrationsDir = values["migrations-dir"];
  if (values.adopt === undefined) {
    return { kind: "migrate", plan, migrationsDir };
  }
  const match = ADOPT_TARGET.exec(values.adopt);
  if (match?.[1] === undefined || match[2] === undefined) {
    return `--adopt expects <module>@<x.y.z>, e.g. auth@0.1.0, got "${values.adopt}"`;
  }
  return { kind: "adopt", plan, module: match[1], version: match[2], migrationsDir };
}

function reportFailure(output: CliOutput, failure: MigrationFailure): number {
  failure.problems.forEach((problem) => output.error(describeProblem(problem)));
  return EXIT_FAILED;
}

function formatStep(step: MigrationStep): string {
  return `${step.module} ${String(step.version).padStart(4, "0")}_${step.name}.sql`;
}

function describeError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
