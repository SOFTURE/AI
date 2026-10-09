import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { parseInitAnswers, toAppName, type InitAnswers } from "../init/answers.js";
import { COMPOSE_FILE, readAppFacts, type AppFacts } from "../init/app-facts.js";
import { DEFAULT_APP_ROLE, planInitFiles, TEMPLATE_VERSIONS, writeInitFiles } from "../init/generate.js";
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

const CALLER_WORKFLOWS = [".github/workflows/deploy.yml", ".github/workflows/release.yml"];

function listNextConfigWarnings(facts: AppFacts): string[] {
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

/** A value `deploy.sh` takes from a compose file init keeps, which could not be read there. */
function listComposeWarnings(facts: AppFacts, replacesCompose: boolean): string[] {
  if (!facts.hasDatabase || !facts.compose || replacesCompose) return [];
  const warnings: string[] = [];
  if (facts.compose.postgresMajor === null) {
    warnings.push(
      `${COMPOSE_FILE}: no Postgres major version in the postgres service's image; deploy.sh's tools image carries pg_dump ${TEMPLATE_VERSIONS.postgres}`,
    );
  }
  if (facts.compose.appDatabaseRole === null) {
    warnings.push(`${COMPOSE_FILE}: no role in the app service's DATABASE_URL; deploy.sh's report reads as ${DEFAULT_APP_ROLE}`);
  }
  return warnings;
}

/** Callers written without --workflows-ref call the moving master; the release tag's commit is the immutable pin. */
function listWorkflowsRefWarnings(options: { written: string[]; workflowsRef: string | undefined; cliVersion: string }): string[] {
  if (options.workflowsRef !== undefined) return [];
  if (!options.written.some((path) => CALLER_WORKFLOWS.includes(path))) return [];
  const tag = `deploy@${options.cliVersion}`;
  return [
    `.github/workflows call SOFTURE/AI's workflows at master; pin the commit of the ${tag} release instead (git ls-remote https://github.com/SOFTURE/AI 'refs/tags/${tag}^{}' prints it) with --workflows-ref=<sha>, or edit their uses: lines`,
  ];
}

/** What init cannot do itself for `--cdn=cloudflare`: root's one-time install and the origin probe's address. */
function listCdnSteps(answers: InitAnswers): string[] {
  if (answers.cdn !== "cloudflare") return [];
  return [
    `as root on the server, install docker/server/cloudflare-only.sh and its two units (the steps are in its header); the firewall lets only Cloudflare reach ports 80 and 443`,
    `set the DEPLOY_ORIGIN_IP secret to the server's own address, so verify checks that a direct connection gets no answer`,
  ];
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
    "workflows-ref": { type: "string" },
    cdn: { type: "string" },
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
    workflowsRef: flags["workflows-ref"],
    cdn: flags.cdn,
  });
  if (!answersResult.ok) fail(`init: nothing written; ${answersResult.problems.join("; ")}.`);
  const cliVersion = readCliVersion();
  const replacesCompose = flags.force && Boolean(facts.compose);
  const files = planInitFiles({ answers: answersResult.answers, facts, cliVersion, replacesCompose });
  const result = writeInitFiles({ dir, files, force: flags.force });
  const warnings = [
    ...listNextConfigWarnings(facts),
    ...listComposeWarnings(facts, replacesCompose),
    ...listWorkflowsRefWarnings({ written: result.written, workflowsRef: answersResult.answers.workflowsRef, cliVersion }),
  ];
  const lines = [
    ...result.written.map((path) => `wrote   ${path}`),
    ...result.skipped.map((path) => `kept    ${path} (exists; --force overwrites it)`),
    ...warnings.map((warning) => `warning ${warning}`),
    ...listCdnSteps(answersResult.answers).map((step) => `next    ${step}`),
    `init: ${result.written.length} written, ${result.skipped.length} kept, database part ${facts.hasDatabase ? "on" : "off"} (@softure-ai/db ${facts.hasDatabase ? "found" : "not found"} in package.json).`,
  ];
  io.stdout(`${lines.join("\n")}\n`);
}
