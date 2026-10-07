import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { parseInitAnswers, toAppName } from "../init/answers.js";
import { readAppFacts, type AppFacts } from "../init/app-facts.js";
import { planInitFiles, writeInitFiles } from "../init/generate.js";
import { fail, USAGE_EXIT_CODE } from "./failure.js";
import type { CliIo } from "./io.js";
import { readFlags } from "./options.js";

/** The version of this package, written into the files so the server runs the same CLI. */
function readCliVersion(): string {
  const pkg = JSON.parse(readFileSync(new URL("../../package.json", import.meta.url), "utf8")) as { version: string };
  return pkg.version;
}

function splitList(text: string | undefined): string[] {
  return (text ?? "")
    .split(",")
    .map((item) => item.trim())
    .filter((item) => item !== "");
}

function listWarnings(facts: AppFacts): string[] {
  if (facts.nextConfigFile === null) return ["no next.config found; the Dockerfile expects a Next standalone build"];
  const warnings: string[] = [];
  if (!facts.isStandalone) {
    warnings.push(`${facts.nextConfigFile} does not mention "standalone"; the Dockerfile needs output: "standalone"`);
  }
  if (facts.hasDatabase && facts.isDbServerExternal === false) {
    warnings.push(
      `${facts.nextConfigFile} does not list "@softure-ai/db" in serverExternalPackages; next build cannot resolve the database driver the app does not install (see serverExternalPackages in the @softure-ai/db README, §2 Installation)`,
    );
  }
  return warnings;
}

/**
 * `softure-deploy init --domain=<host> --image=<registry/name> […]`: writes the app's deploy files once. An existing
 * file is kept and named unless `--force`.
 */
export function runInit(args: string[], io: CliIo): void {
  const flags = readFlags("init", args, {
    domain: { type: "string" },
    image: { type: "string" },
    dir: { type: "string", default: "." },
    name: { type: "string" },
    paths: { type: "string", default: "/" },
    www: { type: "boolean", default: false },
    "acme-email": { type: "string" },
    env: { type: "string" },
    tables: { type: "string" },
    force: { type: "boolean", default: false },
  });
  const missing = (["domain", "image"] as const).filter((name) => flags[name] === undefined);
  if (missing.length > 0) {
    fail(`init: missing ${missing.map((name) => `--${name}`).join(" and ")}.`, USAGE_EXIT_CODE);
  }
  const dir = resolve(io.cwd, flags.dir);
  const factsResult = readAppFacts(dir);
  if (!factsResult.ok) fail(`init: ${factsResult.problem}.`);
  const { facts } = factsResult;
  const answersResult = parseInitAnswers({
    domain: flags.domain,
    image: flags.image,
    name: flags.name ?? toAppName(facts.packageName),
    paths: splitList(flags.paths),
    www: flags.www,
    acmeEmail: flags["acme-email"],
    env: splitList(flags.env),
    tables: splitList(flags.tables),
  });
  if (!answersResult.ok) fail(`init: nothing written; ${answersResult.problems.join("; ")}.`);
  const files = planInitFiles({ answers: answersResult.answers, facts, cliVersion: readCliVersion() });
  const result = writeInitFiles({ dir, files, force: flags.force });
  const lines = [
    ...result.written.map((path) => `wrote   ${path}`),
    ...result.skipped.map((path) => `kept    ${path} (exists; --force overwrites it)`),
    ...listWarnings(facts).map((warning) => `warning ${warning}`),
    `init: ${result.written.length} written, ${result.skipped.length} kept, database part ${facts.hasDatabase ? "on" : "off"} (@softure-ai/db ${facts.hasDatabase ? "found" : "not found"} in package.json).`,
  ];
  io.stdout(`${lines.join("\n")}\n`);
}
