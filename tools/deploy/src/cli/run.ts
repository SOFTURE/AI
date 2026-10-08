import { runBackup, runRowCounts, runSchemaGuard } from "./db-commands.js";
import { runEnvRender } from "./env-command.js";
import { CliFailure, USAGE_EXIT_CODE } from "./failure.js";
import { runInit } from "./init-command.js";
import type { CliIo } from "./io.js";
import { runReleaseNotes } from "./release-notes-command.js";
import { runReleaseReport } from "./release-report-command.js";
import { runRemoteReport, runRemoteScript } from "./remote-command.js";
import { runVerifyCommand } from "./verify-command.js";

export const USAGE = [
  "Usage: softure-deploy <command> [flags]",
  "",
  "  env render [--compose=docker/prod/docker-compose.yml] [--out=.env.prod] [--secrets-json=<VAR>] [--vars-json=<VAR>]",
  "      writes the env file from the environment for every ${NAME:?} of the compose file, and every ${NAME:-} the",
  "      environment sets; with --secrets-json/--vars-json only from the JSON objects those variables hold (vars over",
  "      secrets); prints names only",
  "  release-notes [--to=HEAD] [--from=<tag>] [--match=<glob>] [--repo-url=<url>] [--locale=en|pl] [--out=<file>]",
  "       [--roadmap=<roadmap.md>] [--body=<release body>]",
  "      the release report since the previous tag matching --match (default *); --roadmap adds its done_code items,",
  "      --body writes the report into its section of that release body",
  "  release-report --body=<release body> --summary=<deploy-report.json> [--locale=en|pl] [--out=<file>]",
  "      writes the deploy run's pipeline status and a deployment row (newest first) into their sections of the body",
  "  backup [--dir=backups] [--prefix=db] [--keep=7] [--max-age-days=<n>] [--exclude-table-data=<a,b.c>]",
  "       [--url-env=DATABASE_URL] [--pg-dump=pg_dump] [--from-file=<dump>]",
  "      a pg_dump of the database before a deploy (--from-file: a dump written elsewhere); keeps the newest --keep",
  "      dumps of --prefix, none older than --max-age-days; --exclude-table-data leaves those tables' rows out",
  "  schema-guard [--migrations-dir=<dir>] [--app-migrations-dir=<dir>] [--app-ledger=drizzle.__drizzle_migrations]",
  "       [--url-env=DATABASE_URL | --ledger-file=<file|->] [--print-sql]",
  "      refuses the deploy when the ledgers cannot take the image's exported migrations (checksum, order, missing)",
  "      or the app's drizzle migrations (older image, skipped entry); --print-sql prints the psql script whose",
  "      output --ledger-file reads instead of a connection",
  "  row-counts [--tables=<a,b.c> | --config=deploy.json] [--out=<file>] [--compare=<file>]",
  "       [--url-env=DATABASE_URL | --counts-file=<file|->] [--print-sql]",
  "      counts the --tables, else database.rowCountTables of deploy.json (a missing table is absent); with --compare,",
  "      fails when a table has fewer rows than in the earlier file, was not in it, or is absent now; --print-sql",
  "      prints the statement whose psql output --counts-file reads instead of a connection",
  "  verify <url> [--config=deploy.json] [--timeout=<ms>] [--concurrency=4] [--origin=<host>[:<port>]]",
  "      checks every route of deploy.json against <url>; exits 1 when a check fails",
  "  init --domain=<host> --image=<registry/name> [--dir=.] [--name=<slug>] [--paths=/] [--www] [--acme-email=<email>]",
  "       [--env=NAME,...] [--tables=a,b.c] [--force]",
  "      writes the app's Dockerfile, production compose, Traefik rules, deploy.sh, deploy and release",
  "      workflows and deploy.json; keeps existing files unless --force",
  "  help",
  "",
].join("\n");

/** A command returns nothing when done, or the exit status of what it ran (`run`, `report`). */
type Command = (args: string[], io: CliIo) => void | number | Promise<void | number>;

/** Commands by their words. */
const COMMANDS: Record<string, Command> = {
  "env render": runEnvRender,
  "release-notes": runReleaseNotes,
  "release-report": runReleaseReport,
  backup: runBackup,
  "schema-guard": runSchemaGuard,
  "row-counts": runRowCounts,
  verify: runVerifyCommand,
  init: runInit,
  run: runRemoteScript,
  report: runRemoteReport,
};

function findCommand(argv: string[]): { command: Command; args: string[] } | null {
  for (const [words, command] of Object.entries(COMMANDS)) {
    const parts = words.split(" ");
    if (parts.every((part, index) => argv[index] === part)) return { command, args: argv.slice(parts.length) };
  }
  return null;
}

/** Runs one command and returns the process exit code; expected failures are one line on stderr. */
export async function runCli(argv: string[], io: CliIo): Promise<number> {
  if (argv.length === 0 || ["help", "--help", "-h"].includes(argv[0] ?? "")) {
    io.stdout(USAGE);
    return argv.length === 0 ? USAGE_EXIT_CODE : 0;
  }
  const found = findCommand(argv);
  if (found === null) {
    io.stderr(`softure-deploy: unknown command "${argv.join(" ")}".\n\n${USAGE}`);
    return USAGE_EXIT_CODE;
  }
  try {
    const status = await found.command(found.args, io);
    return status ?? 0;
  } catch (error) {
    if (!(error instanceof CliFailure)) throw error;
    io.stderr(`${error.message}\n`);
    return error.exitCode;
  }
}
