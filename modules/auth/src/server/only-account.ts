// The one account a local tool acts for (a stdio MCP server, a measurement or seed script): the
// account an environment variable names, else the only account in the database. Never the first of
// several: that could be another person's data.
import { err, ok, type Err, type Ok } from "@softure-ai/core";
import type { Queryable } from "@softure-ai/db";
import { eq } from "drizzle-orm";
import { users } from "../schema.js";

const UUID_SHAPE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type OnlyAccountErrorCode = "auth.account_unknown" | "auth.no_account" | "auth.account_ambiguous";

/** Why there is no account to use, with a line for the person running the tool. */
export type OnlyAccountError = Err<OnlyAccountErrorCode> & { readonly message: string };

export type OnlyAccountResult = Ok<string> | OnlyAccountError;

export interface ResolveOnlyAccountOptions {
  readonly db: Queryable;
  /** The variable that may name the account's id, e.g. `MCP_USER_ID`. */
  readonly envName: string;
  /** Default: `process.env`. */
  readonly env?: Readonly<Record<string, string | undefined>>;
}

/**
 * The id of the account `envName` names (it must exist), or, when the variable is empty or unset,
 * of the only account. Refuses an unknown id, an empty database and several accounts with none named.
 */
export async function resolveOnlyAccount(options: ResolveOnlyAccountOptions): Promise<OnlyAccountResult> {
  const { db, envName } = options;
  const requested = (options.env ?? process.env)[envName]?.trim() ?? "";
  if (requested !== "") {
    const unknown = refuse("auth.account_unknown", `${envName} names no account`);
    // Checked before the query: Postgres rejects a malformed uuid with an error, not an empty result.
    if (!UUID_SHAPE.test(requested)) return unknown;
    const [found] = await db.select({ id: users.id }).from(users).where(eq(users.id, requested)).limit(1);
    return found === undefined ? unknown : ok(found.id);
  }
  const [only, second] = await db.select({ id: users.id }).from(users).limit(2);
  if (only === undefined) return refuse("auth.no_account", "the database has no account");
  if (second !== undefined) {
    return refuse("auth.account_ambiguous", `the database has several accounts; set ${envName} to the id of the one to use`);
  }
  return ok(only.id);
}

function refuse(code: OnlyAccountErrorCode, message: string): OnlyAccountError {
  return { ...err(code), message };
}
