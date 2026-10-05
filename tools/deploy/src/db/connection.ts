// The production database URL, read from the environment and never printed. `pg_dump` gets it as libpq variables
// (`PGHOST`, `PGPASSWORD`, …) instead of an argument, so the password never shows in the process list.
import pg from "pg";

/** The default name of the variable that holds the database URL; `--url-env` names another. */
export const DEFAULT_URL_ENV = "DATABASE_URL";

const URL_SCHEMES = new Set(["postgres:", "postgresql:"]);
/** Query parameters of a libpq URL that have an environment variable; any other is refused, never dropped. */
const QUERY_VARIABLES: Readonly<Record<string, string>> = {
  host: "PGHOST",
  port: "PGPORT",
  sslmode: "PGSSLMODE",
  sslrootcert: "PGSSLROOTCERT",
  sslcert: "PGSSLCERT",
  sslkey: "PGSSLKEY",
  connect_timeout: "PGCONNECT_TIMEOUT",
  application_name: "PGAPPNAME",
};
const CONNECT_TIMEOUT_MS = 10_000;

export type LibpqEnvResult = { ok: true; env: Record<string, string> } | { ok: false; problem: string };

/**
 * Splits a `postgres://user:password@host:port/database?sslmode=…` URL into libpq variables. A problem names the part
 * that is wrong, never the URL or its password.
 */
export function toLibpqEnv(url: string): LibpqEnvResult {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return { ok: false, problem: "the database URL is not a valid URL" };
  }
  if (!URL_SCHEMES.has(parsed.protocol)) {
    return { ok: false, problem: `the database URL must start with postgres:// or postgresql://, not ${parsed.protocol}//` };
  }
  const env: Record<string, string> = {};
  const set = (name: string, value: string): void => {
    if (value !== "") env[name] = value;
  };
  // An IPv6 host keeps its brackets in a URL (`[::1]`); libpq takes the bare address.
  set("PGHOST", decodeURIComponent(parsed.hostname.replace(/^\[(.*)\]$/, "$1")));
  set("PGPORT", parsed.port);
  set("PGUSER", decodeURIComponent(parsed.username));
  set("PGPASSWORD", decodeURIComponent(parsed.password));
  set("PGDATABASE", decodeURIComponent(parsed.pathname.replace(/^\//, "")));
  for (const [key, value] of parsed.searchParams) {
    const variable = QUERY_VARIABLES[key];
    if (variable === undefined) {
      return { ok: false, problem: `the database URL has a query parameter pg_dump cannot take: ${key}` };
    }
    set(variable, value);
  }
  return { ok: true, env };
}

/** Whether the URL names a Postgres server (not PGlite or another database), without echoing it. */
export function isPostgresUrl(url: string): boolean {
  return /^postgres(ql)?:\/\//.test(url);
}

/** Opens one connection, runs `run` on it and closes it, also when `run` throws. */
export async function withPgClient<T>(url: string, run: (client: pg.Client) => Promise<T>): Promise<T> {
  const client = new pg.Client({ connectionString: url, connectionTimeoutMillis: CONNECT_TIMEOUT_MS });
  // A dropped connection emits 'error' on the client; without a listener Node crashes. The pending query rejects.
  client.on("error", () => undefined);
  await client.connect();
  try {
    return await run(client);
  } finally {
    await client.end();
  }
}
