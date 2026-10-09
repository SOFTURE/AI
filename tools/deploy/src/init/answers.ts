// The answers of `softure-deploy init`. Every value ends up inside YAML, a bash script or a Traefik rule, so each one
// is held to a narrow pattern here and the templates never quote or escape anything.
import { z } from "zod";
import { parseTableList } from "../db/row-counts.js";

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

const ENV_NAME = /^[A-Z][A-Z0-9_]*$/;

/** Names that steer the runner itself; `deploy-app.yml` refuses them in `app-secrets`. */
const RESERVED_ENV_NAME = /^(PATH|HOME|NODE_.*|NPM_CONFIG_.*)$/;

/** Names the templates already set on the app service, from the domain or the database part. */
export const TEMPLATE_ENV_NAMES = [
  "APP_ORIGIN",
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

export const initAnswersSchema = z.strictObject({
  domain: z.string().regex(DOMAIN, "a lower-case host name such as example.com"),
  image: z.string().regex(IMAGE, "registry/name in lower case without a tag, such as ghcr.io/acme/app"),
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
});

export type InitAnswers = z.infer<typeof initAnswersSchema>;

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
