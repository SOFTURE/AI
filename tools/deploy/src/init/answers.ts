// The answers of `softure-deploy init`. Every value ends up inside YAML, a bash script or a Traefik rule, so each one
// is held to a narrow pattern here and the templates never quote or escape anything.
import { z } from "zod";
import { parseTableList } from "../db/row-counts.js";
import { POSTGRES_ROLE } from "./compose-facts.js";

/** Lower-case DNS name with at least two labels (`example.com`, `app.example.co.uk`). */
const DOMAIN = /^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/;

/** `registry/name` without a tag, the pattern `deploy-app.yml` checks its `image` input against. */
const IMAGE = /^[a-z0-9.-]+(:[0-9]{1,5})?(\/[a-z0-9]+([._-][a-z0-9]+)*)+$/;

/** Compose project and server folder name. */
const NAME = /^[a-z][a-z0-9-]{0,39}$/;

/** `/` or a path prefix of plain segments (`/blog`, `/api/public/`). */
const PATH_PREFIX = /^\/(?:[A-Za-z0-9._~-]+(?:\/[A-Za-z0-9._~-]+)*\/?)?$/;

const EMAIL = /^[A-Za-z0-9._%+-]+@(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/;

/** A commit of SOFTURE/AI, the immutable ref the caller workflows pin. */
const COMMIT_SHA = /^[0-9a-f]{40}$/;

/** Where the app runs (`init --host`): a server of its own, or Cloudflare Workers (docs/07-runtime-providers.md). */
const HOSTS = ["vps", "cloudflare"] as const;

/** A Hyperdrive configuration ID: 32 lower-case hex characters. */
const HYPERDRIVE_ID = /^[0-9a-f]{32}$/;

/** A Workers placement hint, `<provider>:<region>` (`aws:eu-central-1`, `gcp:europe-west1`, `azure:westeurope`). */
const PLACEMENT_REGION = /^(?:aws|gcp|azure):[a-z0-9-]{2,40}$/;

/** The CDNs `init --cdn` can lock the origin to. */
const CDNS = ["cloudflare"] as const;

/** A Docker network name (`docker network create` takes `[a-zA-Z0-9][a-zA-Z0-9_.-]`). */
const NETWORK = /^[A-Za-z0-9][A-Za-z0-9_.-]{0,62}$/;

const ENV_NAME = /^[A-Z][A-Z0-9_]*$/;

/** A relative path of plain segments in the app's repository (`docker/worker.Dockerfile`); never `..`. */
const RELATIVE_FILE = /^(?!.*(?:^|\/)\.\.(?:\/|$))[A-Za-z0-9_.][A-Za-z0-9_.-]*(?:\/[A-Za-z0-9_.-]+)*$/;

/** An absolute folder of plain segments inside the container (`/app/data`), not the root. */
const MOUNT_PATH = /^(?!.*\/\.\.?(?:\/|$))(?:\/[A-Za-z0-9_.-]+)+$/;

/** Folders a data volume must not cover: the image's own code, or a folder the system needs. */
const RESERVED_MOUNT_PATHS = ["/app", "/bin", "/dev", "/etc", "/lib", "/proc", "/sbin", "/sys", "/tmp", "/usr", "/var"];

/** Docker's `cpus`: a positive number of CPUs (`0.5`, `2`). */
const CPUS = /^(?:[1-9][0-9]{0,2}(?:\.[0-9]{1,2})?|0\.(?:[1-9][0-9]?|0[1-9]))$/;

/** A size Docker reads for `mem_limit` and a tmpfs (`512m`, `2g`). */
const SIZE = /^[1-9][0-9]{0,5}[kmg]$/;

/** Names that steer the runner itself; `deploy-app.yml` refuses them in `app-secrets`. */
const RESERVED_ENV_NAME = /^(PATH|HOME|NODE_.*|NPM_CONFIG_.*)$/;

/** Names the templates already set on the app service, from the domain or the database part. */
export const TEMPLATE_ENV_NAMES = [
  "APP_ORIGIN",
  "CLOUDFLARE_TUNNEL_TOKEN",
  "DATABASE_URL",
  "HOSTNAME",
  "PORT",
  "POSTGRES_PASSWORD",
  "SOFTURE_APP_PASSWORD",
  "SOFTURE_MIGRATOR_PASSWORD",
  "TAG",
] as const;

const envNameSchema = z
  .string()
  .regex(ENV_NAME, "an upper snake case name")
  .refine((name) => !RESERVED_ENV_NAME.test(name), "reserved for the runner (PATH, HOME, NODE_*, NPM_CONFIG_*)")
  .refine((name) => !(TEMPLATE_ENV_NAMES as readonly string[]).includes(name), "already set by the templates");

const initAnswersSchema = z
  .strictObject({
    domain: z.string().regex(DOMAIN, "a lower-case host name such as example.com"),
    /** `--host`: absent means `vps`. */
    host: z.enum(HOSTS, { error: "vps or cloudflare" }).optional(),
    /** Required on a VPS, refused on Cloudflare (wrangler uploads the bundle; there is no image). */
    image: z.string().regex(IMAGE, "registry/name in lower case without a tag, such as ghcr.io/acme/app").optional(),
    name: z.string().regex(NAME, "lower case letters, digits and -, starting with a letter, at most 40"),
    paths: z
      .array(z.string().regex(PATH_PREFIX, "/ or a path prefix such as /blog"))
      .min(1)
      .refine((paths) => !paths.includes("/") || paths.length === 1, "/ already allows every path; list it alone"),
    www: z.boolean(),
    acmeEmail: z.string().regex(EMAIL, "an e-mail address").optional(),
    env: z.array(envNameSchema),
    tables: z.array(z.string()).superRefine((tables, context) => {
      if (tables.length === 0) return;
      const parsed = parseTableList(tables.join(","));
      if (!parsed.ok) context.addIssue({ code: "custom", message: parsed.problem });
    }),
    workflowsRef: z.string().regex(COMMIT_SHA, "a full commit SHA of SOFTURE/AI (40 hex characters)").optional(),
    cdn: z.enum(CDNS, { error: "cloudflare, the only CDN init knows" }).optional(),
    /** The role `deploy.sh`'s report reads as, for an app whose compose file does not name it in DATABASE_URL. */
    reportRole: z
      .string()
      .regex(POSTGRES_ROLE, "a Postgres role name: letters, digits and _, starting with a letter or _, at most 63")
      .optional(),
    /** `--edge=<network>`: the app joins an existing Traefik's external network instead of running its own (issue #516). */
    edge: z
      .string()
      .regex(NETWORK, "a Docker network name: letters, digits, _ . -, starting with a letter or digit, at most 63")
      .optional(),
    /** `--tunnel`: the app is published by a Cloudflare Tunnel of its own compose project, with no Traefik (issue #905). */
    tunnel: z.boolean().optional(),
    /** `--worker-dockerfile=<path>`: the worker service runs `<image>-worker`, built from this file (issue #948). */
    workerDockerfile: z.string().regex(RELATIVE_FILE, "a relative path in the app, such as docker/worker.Dockerfile").optional(),
    /** `--data-volume=<mount path>`: one named volume mounted at this path in the app and the worker (issue #948). */
    dataVolume: z
      .string()
      .regex(MOUNT_PATH, "an absolute folder of plain segments, such as /app/data")
      .refine(
        (path) => !RESERVED_MOUNT_PATHS.some((reserved) => path === reserved || (reserved !== "/app" && path.startsWith(`${reserved}/`))),
        `a folder of its own, not ${RESERVED_MOUNT_PATHS.join(", ")} or below a system folder`,
      )
      .optional(),
    /** `--worker-cpus`: the worker's CPU limit (compose `cpus`). */
    workerCpus: z.string().regex(CPUS, "a number of CPUs such as 0.5 or 2").optional(),
    /** `--worker-memory`: the worker's memory limit (compose `mem_limit`). */
    workerMemory: z.string().regex(SIZE, "a size such as 512m or 2g").optional(),
    /** `--worker-tmpfs`: the worker's /tmp in memory, of at most this size. */
    workerTmpfs: z.string().regex(SIZE, "a size such as 512m or 2g").optional(),
    /** `--hyperdrive-id`: the Hyperdrive configuration the Worker reaches Postgres through (`--host=cloudflare`). */
    hyperdriveId: z.string().regex(HYPERDRIVE_ID, "a Hyperdrive configuration ID: 32 lower-case hex characters").optional(),
    /** `--placement-region`: run the Worker next to the database's cloud region instead of Smart Placement. */
    placementRegion: z.string().regex(PLACEMENT_REGION, "<provider>:<region> such as aws:eu-central-1").optional(),
  })
  .superRefine((answers, context) => {
    if (answers.host === "cloudflare") {
      for (const problem of listCloudflareConflicts(answers)) context.addIssue({ code: "custom", path: ["host"], message: problem });
      return;
    }
    if (answers.image === undefined) context.addIssue({ code: "custom", path: ["image"], message: "required on a VPS (--image=registry/name)" });
    for (const [flag, value] of [["--hyperdrive-id", answers.hyperdriveId], ["--placement-region", answers.placementRegion]] as const) {
      if (value !== undefined) context.addIssue({ code: "custom", path: ["host"], message: `${flag} configures a Cloudflare Worker; add --host=cloudflare` });
    }
    if (answers.tunnel === true) {
      for (const problem of listTunnelConflicts(answers)) context.addIssue({ code: "custom", path: ["tunnel"], message: problem });
      return;
    }
    if (answers.edge === undefined) return;
    // Both configure the Traefik and the host of the stack that owns the edge, not this app's.
    for (const [flag, value] of [["--cdn", answers.cdn], ["--acme-email", answers.acmeEmail]] as const) {
      if (value === undefined) continue;
      context.addIssue({ code: "custom", path: ["edge"], message: `${flag} belongs to the stack that owns the edge Traefik; drop it with --edge` });
    }
  });

/** What a tunnel cannot take: each of these configures a Traefik, which a tunnel stack does not run. */
function listTunnelConflicts(answers: {
  edge?: string | undefined;
  cdn?: string | undefined;
  acmeEmail?: string | undefined;
  www: boolean;
  paths: string[];
}): string[] {
  const problems: string[] = [];
  if (answers.edge !== undefined) problems.push("--edge publishes the app through a Traefik; drop it with --tunnel");
  if (answers.cdn !== undefined) problems.push("--cdn locks the ports of a Traefik a tunnel stack does not run; drop it with --tunnel");
  if (answers.acmeEmail !== undefined) problems.push("--acme-email configures Traefik's certificates; Cloudflare holds them with --tunnel");
  if (answers.www) problems.push("--www is a Traefik redirect; with --tunnel add a Cloudflare redirect rule from www to the apex");
  if (!answers.paths.includes("/")) {
    problems.push("--paths is a Traefik rule; with --tunnel pass / and restrict the paths on the tunnel's public hostname");
  }
  return problems;
}

/** What a Cloudflare Worker cannot take: each of these configures Docker, Traefik or the server, which it has none of. */
function listCloudflareConflicts(answers: {
  image?: string | undefined;
  edge?: string | undefined;
  tunnel?: boolean | undefined;
  cdn?: string | undefined;
  acmeEmail?: string | undefined;
  www: boolean;
  paths: string[];
  tables: string[];
  reportRole?: string | undefined;
  workerDockerfile?: string | undefined;
  dataVolume?: string | undefined;
  workerCpus?: string | undefined;
  workerMemory?: string | undefined;
  workerTmpfs?: string | undefined;
}): string[] {
  const serverFlags = [
    ["--image", answers.image, "wrangler uploads the bundle, there is no image"],
    ["--edge", answers.edge, "a Worker has no Traefik"],
    ["--tunnel", answers.tunnel === true ? true : undefined, "Cloudflare serves the Worker on its custom domain"],
    ["--cdn", answers.cdn, "a Worker is behind Cloudflare already"],
    ["--acme-email", answers.acmeEmail, "Cloudflare holds the certificate"],
    ["--report-role", answers.reportRole, "it names the role of deploy.sh's report on the server"],
    ["--worker-dockerfile", answers.workerDockerfile, "jobs run from the Worker's Cron Trigger"],
    ["--data-volume", answers.dataVolume, "a Worker has no disk; store files in R2"],
    ["--worker-cpus", answers.workerCpus, "jobs run from the Worker's Cron Trigger"],
    ["--worker-memory", answers.workerMemory, "jobs run from the Worker's Cron Trigger"],
    ["--worker-tmpfs", answers.workerTmpfs, "jobs run from the Worker's Cron Trigger"],
  ] as const;
  const problems = serverFlags.filter(([, value]) => value !== undefined).map(([flag, , why]) => `${flag} is a VPS flag: ${why}`);
  if (answers.www) problems.push("--www is a Traefik redirect; with --host=cloudflare add a Cloudflare redirect rule from www to the apex");
  if (!answers.paths.includes("/")) problems.push("--paths is a Traefik rule; with --host=cloudflare the Worker answers every path");
  if (answers.tables.length > 0) problems.push("--tables are counted by deploy.sh on the server; with --host=cloudflare there is none");
  return problems;
}

export type InitAnswers = z.infer<typeof initAnswersSchema>;

/** The host the answers deploy to. */
export function getHost(answers: Pick<InitAnswers, "host">): (typeof HOSTS)[number] {
  return answers.host ?? "vps";
}

export type InitAnswersResult = { ok: true; answers: InitAnswers } | { ok: false; problems: string[] };

/** Narrows the answers at the boundary; each problem is one `field: message` line. */
export function parseInitAnswers(input: unknown): InitAnswersResult {
  const parsed = initAnswersSchema.safeParse(input);
  if (parsed.success) return { ok: true, answers: parsed.data };
  const problems = parsed.error.issues.map((issue) => {
    const where = issue.path.length > 0 ? issue.path.join(".") : "answers";
    return `${where}: ${issue.message}`;
  });
  return { ok: false, problems };
}

/** `@acme/web-app` → `web-app`; a name with nothing usable left falls back to `app`. */
export function toAppName(packageName: string | undefined): string {
  const bare = (packageName ?? "").replace(/^@[^/]+\//, "").toLowerCase();
  const slug = bare
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^[^a-z]+/, "")
    .slice(0, 40)
    .replace(/-+$/, "");
  return slug === "" ? "app" : slug;
}
