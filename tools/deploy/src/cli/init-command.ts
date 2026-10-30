import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { parseInitAnswers, toAppName, type InitAnswers } from "../init/answers.js";
import { COMPOSE_FILE, readAppFacts, type AppFacts } from "../init/app-facts.js";
import { DEFAULT_APP_ROLE, hasWorker, hasWorkerHeartbeat, JOBS_HEARTBEAT_VERSION, planInitFiles, TEMPLATE_VERSIONS, writeInitFiles } from "../init/generate.js";
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

const CALLER_WORKFLOWS = [
  ".github/workflows/deploy.yml",
  ".github/workflows/release.yml",
  ".github/workflows/release-notes.yml",
  ".github/workflows/checks.yml",
];

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

/** `@softure-ai/jobs` without `@softure-ai/db`: the worker container is part of the database part. */
function listWorkerWarnings(facts: AppFacts): string[] {
  if (facts.hasJobs !== true || facts.hasDatabase) return [];
  return ["@softure-ai/jobs is a dependency but @softure-ai/db is not; the worker container needs the database part, so none was written"];
}

/** A worker whose jobs version has no heartbeat: its health check proves only that the process runs. */
function listWorkerHeartbeatWarnings(facts: AppFacts): string[] {
  if (!hasWorker(facts) || hasWorkerHeartbeat(facts)) return [];
  const version = facts.jobsVersion ?? "of unknown version";
  return [
    `@softure-ai/jobs ${version} has no worker heartbeat; the worker service checks only that its process runs (upgrade to ${JOBS_HEARTBEAT_VERSION} or later and re-run init for a check of its loop)`,
  ];
}

/** A value `deploy.sh` takes from a compose file init keeps, which could not be read there. */
function listComposeWarnings(facts: AppFacts, answers: InitAnswers, replacesCompose: boolean): string[] {
  if (!facts.hasDatabase || !facts.compose || replacesCompose) return [];
  const warnings: string[] = [];
  if (facts.compose.postgresMajor === null) {
    warnings.push(
      `${COMPOSE_FILE}: no Postgres major version in the postgres service's image; deploy.sh's tools image carries pg_dump ${TEMPLATE_VERSIONS.postgres}`,
    );
  }
  if (facts.compose.appDatabaseRole === null && answers.reportRole === undefined) {
    warnings.push(
      `${COMPOSE_FILE}: no role in the app service's DATABASE_URL; deploy.sh's report reads as ${DEFAULT_APP_ROLE} (name the role with --report-role=<role>)`,
    );
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

/** A second stack on a server (`--edge`, or `--tunnel` next to another app): its Postgres takes the first one's loopback port. */
function listEdgeWarnings(facts: AppFacts, answers: InitAnswers): string[] {
  if ((answers.edge === undefined && answers.tunnel !== true) || !facts.hasDatabase) return [];
  return [
    `${COMPOSE_FILE} publishes Postgres on 127.0.0.1:5432, which another stack on this server may hold already; change the host port, or drop it and set database.access to compose-exec in deploy.json`,
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

/** What init cannot do itself for `--tunnel`: the tunnel in Cloudflare, its token, and the headers Traefik sent. */
function listTunnelSteps(answers: InitAnswers): string[] {
  if (answers.tunnel !== true) return [];
  return [
    `in Cloudflare Zero Trust, create a remotely managed tunnel and give it the public hostname ${answers.domain} with the service http://app:3000`,
    "set the CLOUDFLARE_TUNNEL_TOKEN secret (the production environment) to the tunnel's token",
    "send the security headers from the app (HSTS, X-Content-Type-Options, X-Frame-Options, Referrer-Policy): no Traefik adds them; the README's Cloudflare Tunnel section has a next.config snippet",
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
    "report-role": { type: "string" },
    edge: { type: "string" },
    tunnel: { type: "boolean", default: false },
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
    reportRole: flags["report-role"],
    edge: flags.edge,
    tunnel: flags.tunnel,
  });
  if (!answersResult.ok) fail(`init: nothing written; ${answersResult.problems.join("; ")}.`);
  const cliVersion = readCliVersion();
  const replacesCompose = flags.force && Boolean(facts.compose);
  const files = planInitFiles({ answers: answersResult.answers, facts, cliVersion, replacesCompose });
  const result = writeInitFiles({ dir, files, force: flags.force });
  const warnings = [
    ...listNextConfigWarnings(facts),
    ...listWorkerWarnings(facts),
    ...listWorkerHeartbeatWarnings(facts),
    ...listComposeWarnings(facts, answersResult.answers, replacesCompose),
    ...listEdgeWarnings(facts, answersResult.answers),
    ...listWorkflowsRefWarnings({ written: result.written, workflowsRef: answersResult.answers.workflowsRef, cliVersion }),
  ];
  const lines = [
    ...result.written.map((path) => `wrote   ${path}`),
    ...result.skipped.map((path) => `kept    ${path} (exists; --force overwrites it)`),
    ...warnings.map((warning) => `warning ${warning}`),
    ...listCdnSteps(answersResult.answers).map((step) => `next    ${step}`),
    ...listTunnelSteps(answersResult.answers).map((step) => `next    ${step}`),
    `init: ${result.written.length} written, ${result.skipped.length} kept, database part ${facts.hasDatabase ? "on" : "off"} (@softure-ai/db ${facts.hasDatabase ? "found" : "not found"} in package.json)${hasWorker(facts) ? ", worker part on (@softure-ai/jobs found)" : ""}.`,
  ];
  io.stdout(`${lines.join("\n")}\n`);
}
