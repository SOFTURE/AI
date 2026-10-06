// The files `softure-deploy init` writes: each template rendered with the answers and the app's facts. Planning is
// pure; writing creates new files only, unless forced.
import { chmodSync, lstatSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { findRequiredNames } from "../env/required-names.js";
import { DEPLOY_SCHEMA_URL } from "../verify/schema.js";
import type { InitAnswers } from "./answers.js";
import type { AppFacts } from "./app-facts.js";
import { renderTemplate, type TemplateValues } from "./render-template.js";

/** `templates/` of the package, next to `src/` and `dist/`. */
export const TEMPLATES_DIR = fileURLToPath(new URL("../../templates/", import.meta.url));

/** Pinned versions written into the files; the app bumps them there. */
export const TEMPLATE_VERSIONS = {
  traefik: "v3.5",
  postgres: "16",
  esbuild: "0.28.2",
} as const;

const EXECUTABLE_MODE = 0o755;
const FILE_MODE = 0o644;

/** Health route of `@softure-ai/ops`; an app without it is checked on `/`. */
const OPS_HEALTH_PATH = "/api/health";

interface TemplateFile {
  template: string;
  target: string;
  mode: number;
  isIncluded: (facts: AppFacts) => boolean;
}

const always = (): boolean => true;
const withDatabase = (facts: AppFacts): boolean => facts.hasDatabase;

/** Every file init can write, in the order it reports them. */
export const TEMPLATE_FILES: readonly TemplateFile[] = [
  { template: "Dockerfile.tmpl", target: "Dockerfile", mode: FILE_MODE, isIncluded: always },
  { template: ".dockerignore.tmpl", target: ".dockerignore", mode: FILE_MODE, isIncluded: always },
  { template: "docker/prod/docker-compose.yml.tmpl", target: "docker/prod/docker-compose.yml", mode: FILE_MODE, isIncluded: always },
  { template: "docker/prod/traefik.yml.tmpl", target: "docker/prod/traefik.yml", mode: FILE_MODE, isIncluded: always },
  { template: "docker/prod/initdb/01-roles.sql.tmpl", target: "docker/prod/initdb/01-roles.sql", mode: FILE_MODE, isIncluded: withDatabase },
  { template: "docker/server/deploy.sh.tmpl", target: "docker/server/deploy.sh", mode: EXECUTABLE_MODE, isIncluded: always },
  { template: "scripts/migrate.ts.tmpl", target: "scripts/migrate.ts", mode: FILE_MODE, isIncluded: withDatabase },
  { template: ".github/workflows/deploy.yml.tmpl", target: ".github/workflows/deploy.yml", mode: FILE_MODE, isIncluded: always },
  { template: ".github/workflows/release.yml.tmpl", target: ".github/workflows/release.yml", mode: FILE_MODE, isIncluded: always },
  { template: "deploy.json.tmpl", target: "deploy.json", mode: FILE_MODE, isIncluded: always },
];

export interface PlannedFile {
  path: string;
  text: string;
  mode: number;
}

export interface PlanInitFilesOptions {
  answers: InitAnswers;
  facts: AppFacts;
  cliVersion: string;
  /** Reads a template by its path under `templates/`; tests may pass their own. */
  readTemplate?: (path: string) => string;
}

function readPackagedTemplate(path: string): string {
  return readFileSync(join(TEMPLATES_DIR, path), "utf8");
}

function getHealthPath(facts: AppFacts): string {
  return facts.hasHealthRoute ? OPS_HEALTH_PATH : "/";
}

/**
 * The apex rule: the host alone for `/`, else the host and the allowed prefixes, plus what every Next page needs
 * (`/_next/`) and the health route the workflow waits for.
 */
export function buildAppRule(answers: InitAnswers, facts: AppFacts): string {
  const host = `Host(\`${answers.domain}\`)`;
  if (answers.paths.includes("/")) return host;
  const prefixes = [...new Set(["/_next/", getHealthPath(facts), ...answers.paths])].filter((path) => path !== "/");
  const paths = prefixes.map((prefix) => `PathPrefix(\`${prefix}\`)`).join(" || ");
  return `${host} && (Path(\`/\`) || ${paths})`;
}

function buildValues(options: PlanInitFilesOptions): Record<string, string | boolean> {
  const { answers, facts, cliVersion } = options;
  const isEveryPath = answers.paths.includes("/");
  return {
    name: answers.name,
    domain: answers.domain,
    domainPattern: answers.domain.replaceAll(".", "\\\\."),
    image: answers.image,
    cliVersion,
    database: facts.hasDatabase,
    databaseName: answers.name.replaceAll("-", "_"),
    publicDir: facts.hasPublicDir,
    healthPath: getHealthPath(facts),
    healthRoute: facts.hasHealthRoute,
    www: answers.www,
    hasAcmeEmail: answers.acmeEmail !== undefined,
    acmeEmail: answers.acmeEmail ?? "",
    hasAppEnv: answers.env.length > 0,
    appEnvLines: answers.env.map((name) => `      ${name}: \${${name}:?}`).join("\n"),
    appRule: buildAppRule(answers, facts),
    pathsNote: isEveryPath ? " on every path" : ` on ${answers.paths.join(", ")}`,
    hasRowCountTables: facts.hasDatabase && answers.tables.length > 0,
    rowCountTablesJson: answers.tables.map((table) => JSON.stringify(table)).join(", "),
    schemaUrl: DEPLOY_SCHEMA_URL,
    traefikVersion: TEMPLATE_VERSIONS.traefik,
    postgresVersion: TEMPLATE_VERSIONS.postgres,
    esbuildVersion: TEMPLATE_VERSIONS.esbuild,
  };
}

/** Renders every file init writes for this app; pure apart from reading the templates. */
export function planInitFiles(options: PlanInitFilesOptions): PlannedFile[] {
  const readTemplate = options.readTemplate ?? readPackagedTemplate;
  const base = buildValues(options);
  const included = TEMPLATE_FILES.filter((file) => file.isIncluded(options.facts));
  const compose = included.find((file) => file.target === "docker/prod/docker-compose.yml");
  // The caller workflow names the secrets the compose file requires, so both come from the same text.
  const composeText = compose ? renderTemplate(readTemplate(compose.template), base) : "";
  const required = findRequiredNames(composeText).map((variable) => variable.name);
  const values: TemplateValues = { ...base, secretNames: required.length > 0 ? required.join(", ") : "none" };
  return included.map((file) => ({
    path: file.target,
    text: file === compose ? composeText : renderTemplate(readTemplate(file.template), values),
    mode: file.mode,
  }));
}

function exists(path: string): boolean {
  try {
    lstatSync(path);
    return true;
  } catch {
    return false;
  }
}

export interface WriteInitFilesResult {
  written: string[];
  skipped: string[];
}

/**
 * Writes the planned files under `dir`. An existing file (or link) is skipped unless `force`; a forced one is
 * removed first, so the write never follows a link out of the app.
 */
export function writeInitFiles(options: { dir: string; files: PlannedFile[]; force: boolean }): WriteInitFilesResult {
  const result: WriteInitFilesResult = { written: [], skipped: [] };
  for (const file of options.files) {
    const target = join(options.dir, file.path);
    if (exists(target)) {
      if (!options.force) {
        result.skipped.push(file.path);
        continue;
      }
      rmSync(target, { force: true });
    }
    mkdirSync(dirname(target), { recursive: true });
    writeFileSync(target, file.text, { mode: file.mode, flag: "wx" });
    // `mode` above is masked by the umask; the script must be executable whatever the shell's umask is.
    chmodSync(target, file.mode);
    result.written.push(file.path);
  }
  return result;
}
