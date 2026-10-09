// What `init` reads from an app's existing production compose file: the Postgres major of the `postgres` service and
// the role of the `app` service's DATABASE_URL, the two names `deploy.sh` addresses. Line based: both values are
// single scalars, and the package carries no YAML parser.

export interface ComposeFacts {
  /** Major version of the `postgres` service's image tag (`17-alpine` → `17`), or null when it cannot be read. */
  postgresMajor: string | null;
  /** User of the `app` service's DATABASE_URL, or null when it is missing, a variable or not a plain identifier. */
  appDatabaseRole: string | null;
}

const SERVICES_KEY = /^services:\s*(#.*)?$/;
const SERVICE_KEY = /^(\s+)([A-Za-z0-9._-]+):\s*(#.*)?$/;
const IMAGE_LINE = /^\s+image:\s*["']?([^"'\s#]+)["']?\s*(#.*)?$/;
/** A major of the tag's start: `17`, `17.2`, `17-alpine`, `pg17`, `17-3.5-alpine`. */
const TAG_MAJOR = /^(?:pg)?([1-9][0-9])(?:[.-]|$)/;
const DATABASE_URL = /^\s+-?\s*["']?DATABASE_URL["']?\s*[:=]\s*["']?postgres(?:ql)?:\/\/([^:@/\s"']+)[:@]/;
/** It lands unquoted in bash and names a Postgres role as psql's --username. */
const ROLE = /^[A-Za-z_][A-Za-z0-9_]{0,62}$/;

/** The lines of each service one level under the top-level `services:` key, by service name. */
function splitServices(text: string): Map<string, string[]> {
  const services = new Map<string, string[]>();
  let isInServices = false;
  let serviceIndent: number | null = null;
  let current: string[] | null = null;
  for (const line of text.split("\n")) {
    if (line.trim() === "" || line.trim().startsWith("#")) continue;
    if (!/^\s/.test(line)) {
      isInServices = SERVICES_KEY.test(line);
      current = null;
      continue;
    }
    if (!isInServices) continue;
    const key = SERVICE_KEY.exec(line);
    const indent = line.length - line.trimStart().length;
    serviceIndent ??= indent;
    if (key !== null && indent === serviceIndent) {
      current = [];
      services.set(key[2] ?? "", current);
      continue;
    }
    current?.push(line);
  }
  return services;
}

function readPostgresMajor(lines: readonly string[]): string | null {
  for (const line of lines) {
    const image = IMAGE_LINE.exec(line)?.[1];
    if (image === undefined) continue;
    const lastSegment = image.slice(image.lastIndexOf("/") + 1);
    const colon = lastSegment.indexOf(":");
    if (colon === -1) return null;
    return TAG_MAJOR.exec(lastSegment.slice(colon + 1))?.[1] ?? null;
  }
  return null;
}

function readDatabaseRole(lines: readonly string[]): string | null {
  for (const line of lines) {
    const role = DATABASE_URL.exec(line)?.[1];
    if (role !== undefined) return ROLE.test(role) ? role : null;
  }
  return null;
}

/** Reads the two facts from the compose file's text; pure. */
export function readComposeFacts(text: string): ComposeFacts {
  const services = splitServices(text);
  return {
    postgresMajor: readPostgresMajor(services.get("postgres") ?? []),
    appDatabaseRole: readDatabaseRole(services.get("app") ?? []),
  };
}
