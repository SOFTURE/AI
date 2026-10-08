import { z } from "zod";
import { TABLE_NAME_PATTERN } from "../db/row-counts.js";

export const DEPLOY_SCHEMA_URL = "https://unpkg.com/@softure-ai/deploy/schema/deploy.schema.json";

/** Default time one request may take, in milliseconds. */
export const DEFAULT_TIMEOUT_MS = 10_000;

const HEADER_NAME = /^[a-z0-9!#$%&'*+.^_`|~-]+$/;

/** Request methods a route may use; `GET` and `HEAD` carry no body. */
export const ROUTE_METHODS = ["GET", "HEAD", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"] as const;

/** Request headers `fetch` sets itself or that would point the request elsewhere; a route cannot set them. */
const RESERVED_REQUEST_HEADERS = new Set(["host", "content-length", "connection", "transfer-encoding"]);

/** A path on the app's host: `//` would make the URL protocol-relative and point at another host. */
const ROUTE_PATH = /^\/(?!\/)\S*$/;

const headerChecksSchema = z
  .record(
    z.string().regex(HEADER_NAME, "a header name in lower case"),
    z
      .union([z.string().min(1), z.null()])
      .describe("Text the header value must contain (case-insensitive), or null when the header must be absent."),
  )
  .describe("Headers by lower-case name: text the value must contain, or null when the header must be absent.");

const requestHeadersSchema = z
  .record(
    z
      .string()
      .regex(HEADER_NAME, "a header name in lower case")
      .refine((name) => !RESERVED_REQUEST_HEADERS.has(name), "a header the request sets itself (host, content-length, connection, transfer-encoding)"),
    z.string().describe("The header value sent."),
  )
  .default({})
  .describe("Headers sent with the request, by lower-case name, on top of verify's own (user-agent, accept, cache-control).");

const routeSchema = z
  .strictObject({
    path: z
      .string()
      .regex(ROUTE_PATH, "a path that starts with a single /")
      .describe("Path on the verified URL, starting with /; a query string is allowed."),
    status: z.int().min(100).max(599).default(200).describe("Expected HTTP status (redirects are not followed)."),
    contains: z
      .array(z.string().min(1))
      .default([])
      .describe("Markers the response body must contain, for example a heading only the real page has."),
    excludes: z
      .array(z.string().min(1))
      .default([])
      .describe("Markers the response body must not contain, for example the text of an error page."),
    redirect: z
      .string()
      .min(1)
      .optional()
      .describe("Expected Location of a redirect: a path on the verified URL or an absolute URL. Needs a 3xx status."),
    headers: headerChecksSchema.default({}),
    method: z
      .enum(ROUTE_METHODS)
      .default("GET")
      .describe("Request method. A POST route runs on every verify: make it one the app treats as a no-op or a check."),
    body: z.string().optional().describe("Request body, sent as is; set its content-type in requestHeaders. Not with GET or HEAD."),
    requestHeaders: requestHeadersSchema,
  })
  .refine((route) => route.redirect === undefined || (route.status >= 300 && route.status < 400), {
    message: "a redirect needs a 3xx status",
    path: ["status"],
  })
  .refine((route) => route.body === undefined || (route.method !== "GET" && route.method !== "HEAD"), {
    message: "a body needs a method other than GET or HEAD",
    path: ["body"],
  })
  .refine((route) => route.method !== "HEAD" || (route.contains.length === 0 && route.excludes.length === 0), {
    message: "a HEAD response has no body to hold markers",
    path: ["method"],
  })
  .describe("One route to request and what its response must look like.");

const verifySchema = z
  .strictObject({
    timeoutMs: z
      .int()
      .min(100)
      .max(120_000)
      .default(DEFAULT_TIMEOUT_MS)
      .describe("Time one request may take, in milliseconds; --timeout overrides it."),
    headers: headerChecksSchema
      .default({})
      .describe("Header checks for every route (security headers); a route's own entry for the same name wins."),
    routes: z.array(routeSchema).min(1).describe("Routes checked by softure-deploy verify, in report order."),
    tlsMinDays: z
      .int()
      .min(1)
      .max(365)
      .optional()
      .describe(
        "Fewest days the TLS certificate of the verified https URL may have left; fewer, or an untrusted certificate, fails verify.",
      ),
  })
  .describe("What softure-deploy verify checks after a deploy.");

/** An absolute path inside the image, segments of plain characters (`..` is refused separately). */
const IMAGE_PATH = /^(\/[A-Za-z0-9_.@+-]+)+$/;

const tableNameSchema = z.string().regex(TABLE_NAME_PATTERN, "a table or schema.table in lower snake case");

const databaseSchema = z
  .strictObject({
    rowCountTables: z
      .array(tableNameSchema)
      .min(1)
      .superRefine((tables, context) => {
        const duplicates = new Set(tables.filter((table, index) => tables.indexOf(table) !== index));
        for (const table of duplicates) context.addIssue({ code: "custom", message: `${table} is listed twice` });
      })
      .meta({ uniqueItems: true })
      .optional()
      .describe("Tables softure-deploy row-counts compares when --tables is not given: table or schema.table."),
    access: z
      .enum(["host", "compose-exec"])
      .optional()
      .describe(
        "How deploy.sh reaches the database: host (default) connects to 127.0.0.1:5432 as postgres with POSTGRES_PASSWORD; compose-exec runs pg_dump and psql in the postgres service as POSTGRES_USER on POSTGRES_DB of .env.prod, for a Postgres that publishes no port.",
      ),
    appMigrations: z
      .strictObject({
        journal: z
          .string()
          .regex(IMAGE_PATH, "an absolute path in the image")
          .refine((path) => !path.split("/").includes(".."), "a path without .. segments")
          .describe("The app migrator's journal in the image, e.g. /app/drizzle/meta/_journal.json ({ \"entries\": [...] })."),
        ledger: tableNameSchema.optional().describe("The ledger table the app migrator fills; default drizzle.__drizzle_migrations."),
      })
      .optional()
      .describe("An app's own migrations: the schema step refuses an image whose journal lists fewer entries than the ledger has rows."),
    excludeTableData: z
      .array(tableNameSchema)
      .min(1)
      .optional()
      .describe("Tables whose rows stay out of deploy.sh's backups (their definition stays), e.g. a table of IP addresses."),
  })
  .describe("Settings of the database steps of softure-deploy.");

/** Hook names are step names in deploy.sh's output, so these are taken. */
export const BUILT_IN_STEP_NAMES = [
  "command",
  "lock",
  "archive",
  "files",
  "settings",
  "pull",
  "postgres",
  "backup",
  "schema",
  "row-counts-before",
  "switch",
  "traefik",
  "row-counts-after",
  "tag",
  "cron",
  "env",
  "images",
  "restore",
] as const;

const HOOK_NAME = /^[a-z][a-z0-9-]{0,39}$/;
/** Five cron fields of digits and `* / , -`: nothing a crontab line could read as more than a schedule. */
export const CRON_SCHEDULE_PATTERN = /^[0-9*/,-]+( [0-9*/,-]+){4}$/;

const hookNameSchema = z
  .string()
  .regex(HOOK_NAME, "a lower-case word of letters, digits and -, at most 40")
  .refine((name) => !(BUILT_IN_STEP_NAMES as readonly string[]).includes(name), "a name deploy.sh uses for its own step")
  .describe("The hook's name: its step line in deploy.sh's output (step|<name>|ok).");

const argumentsSchema = z
  .array(z.string().min(1).regex(/^[^\n\r\0]*$/, "one line without NUL"))
  .min(1);

const composeHookFields = {
  name: hookNameSchema,
  compose: argumentsSchema.describe(
    "Arguments of docker compose --env-file .env.prod --file docker-compose.yml, e.g. [\"run\", \"--rm\", \"migrate\", \"node\", \"import.mjs\"].",
  ),
};
const runHookFields = {
  name: hookNameSchema,
  run: argumentsSchema.describe(
    "A command run on the host in the app folder, e.g. [\"bash\", \"hooks/check-env.sh\"] for a script the release ships in the compose file's folder (installed 0644, so call it through bash).",
  ),
};

const hookSchema = z
  .union([z.strictObject(composeHookFields), z.strictObject(runHookFields)])
  .describe("One app step: compose arguments or a host command; it gets TAG, IMAGE and PREVIOUS_TAG, its output goes to stderr.");

const scheduleSchema = z
  .string()
  .regex(CRON_SCHEDULE_PATTERN, "five cron fields of digits and * / , -")
  .optional()
  .describe("Its own crontab line with this schedule (deploy.sh maintain <name>) instead of the daily maintain run.");

const maintainHookSchema = z
  .union([z.strictObject({ ...composeHookFields, schedule: scheduleSchema }), z.strictObject({ ...runHookFields, schedule: scheduleSchema })])
  .describe("One app step of maintenance: in the daily maintain run, or on its own schedule.");

const hooksSchema = z
  .strictObject({
    "pre-migrate": z
      .array(hookSchema)
      .optional()
      .describe("After the backup, the schema guard and the row counts, before the switch (whose migrate service runs first); a failure puts the previous files back."),
    "post-up": z
      .array(hookSchema)
      .optional()
      .describe("After the release is live (tag recorded, cron installed); a failure fails the release and rolls nothing back."),
    maintain: z.array(maintainHookSchema).optional().describe("After the daily backup and image cleanup, or on their own schedule."),
  })
  .superRefine((hooks, context) => {
    const names = [...(hooks["pre-migrate"] ?? []), ...(hooks["post-up"] ?? []), ...(hooks.maintain ?? [])].map((hook) => hook.name);
    const duplicates = new Set(names.filter((name, index) => names.indexOf(name) !== index));
    for (const name of duplicates) context.addIssue({ code: "custom", message: `the hook name ${name} is used twice` });
  })
  .describe("App steps deploy.sh runs at named points of a deploy and of maintenance, in the listed order.");

export const deploySchema = z
  .strictObject({
    $schema: z.string().optional().describe("JSON Schema of this file, for editor completion."),
    database: databaseSchema.optional(),
    hooks: hooksSchema.optional(),
    verify: verifySchema.optional(),
  })
  .describe("deploy.json: the app's deploy settings read by softure-deploy.");

export type DeployConfig = z.output<typeof deploySchema>;
export type VerifyConfig = NonNullable<DeployConfig["verify"]>;
export type VerifyRoute = VerifyConfig["routes"][number];
export type HeaderChecks = VerifyRoute["headers"];
export type DeployConfigInput = z.input<typeof deploySchema>;
export type DeployHooks = NonNullable<DeployConfig["hooks"]>;
export type DeployHook = NonNullable<DeployHooks["pre-migrate"]>[number];
export type MaintainHook = NonNullable<DeployHooks["maintain"]>[number];

export type ParsedDeployConfig = { ok: true; config: DeployConfig } | { ok: false; issues: string[] };

/** `deploy.json` from untrusted JSON: the config, or one `path: message` line per problem. */
export function parseDeployConfig(value: unknown): ParsedDeployConfig {
  const result = deploySchema.safeParse(value);
  if (result.success) return { ok: true, config: result.data };
  const issues = result.error.issues.map((issue) => {
    const path = issue.path.map(String).join(".");
    // A bad record key reports "Invalid key in record"; the key's own issue says what is wrong with it.
    const message = issue.code === "invalid_key" ? (issue.issues[0]?.message ?? issue.message) : issue.message;
    return `${path === "" ? "(root)" : path}: ${message}`;
  });
  return { ok: false, issues };
}

export function getDeployJsonSchema(): Record<string, unknown> {
  return {
    ...z.toJSONSchema(deploySchema, { io: "input" }),
    $id: DEPLOY_SCHEMA_URL,
    title: "deploy.json for @softure-ai/deploy",
  };
}
