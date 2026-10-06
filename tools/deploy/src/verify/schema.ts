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

const databaseSchema = z
  .strictObject({
    rowCountTables: z
      .array(z.string().regex(TABLE_NAME_PATTERN, "a table or schema.table in lower snake case"))
      .min(1)
      .superRefine((tables, context) => {
        const duplicates = new Set(tables.filter((table, index) => tables.indexOf(table) !== index));
        for (const table of duplicates) context.addIssue({ code: "custom", message: `${table} is listed twice` });
      })
      .meta({ uniqueItems: true })
      .optional()
      .describe("Tables softure-deploy row-counts compares when --tables is not given: table or schema.table."),
  })
  .describe("Settings of the database steps of softure-deploy.");

export const deploySchema = z
  .strictObject({
    $schema: z.string().optional().describe("JSON Schema of this file, for editor completion."),
    database: databaseSchema.optional(),
    verify: verifySchema.optional(),
  })
  .describe("deploy.json: the app's deploy settings read by softure-deploy.");

export type DeployConfig = z.output<typeof deploySchema>;
export type VerifyConfig = NonNullable<DeployConfig["verify"]>;
export type VerifyRoute = VerifyConfig["routes"][number];
export type HeaderChecks = VerifyRoute["headers"];
export type DeployConfigInput = z.input<typeof deploySchema>;

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
