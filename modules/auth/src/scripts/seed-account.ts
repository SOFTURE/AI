// A development login account from `SEED_EMAIL` and `SEED_PASSWORD`, created through the module's
// registration, so the app's `onRegistered` hook runs as for a real sign-up. Idempotent: an account
// with that email is left as it is. Not an ops script: it refuses to run with NODE_ENV=production.
//
//   // scripts/seed.ts, run with `tsx scripts/seed.ts`
//   import { runSeedAccount } from "@softure-ai/auth/scripts";
//   import config from "../softure.config";
//   process.exitCode = await runSeedAccount({ config });
import { errorLogLabel, safeError, systemClock, type Clock, type SoftureConfig } from "@softure-ai/core";
import { openCommandDatabase, type Database } from "@softure-ai/db";
import { EXIT_FAILED, EXIT_OK, EXIT_USAGE, type CliOutput } from "@softure-ai/db/cli";
import { registerUser, type RegisterErrorCode } from "../server/register.js";
import { logoutSession, type AuthContext } from "../server/sessions.js";
import { normalizeEmail } from "../server/validation.js";

const NAME = "seed-account";
/** The rate limit key the seed counts registration attempts under. */
const SEED_CLIENT_KEY = "script:seed";

export interface RunSeedAccountOptions {
  readonly config: SoftureConfig;
  /** Default: `process.env`. Reads `SEED_EMAIL`, `SEED_PASSWORD` and `NODE_ENV`. */
  readonly env?: Readonly<Record<string, string | undefined>>;
  /** An open database to use instead of the config's (tests); it is not closed. */
  readonly database?: Database;
  /** Default: the console. The password is never printed. */
  readonly output?: CliOutput;
  readonly clock?: Clock;
}

const REFUSALS: Readonly<Record<Exclude<RegisterErrorCode, "auth.email_taken">, string>> = {
  "auth.registration_closed": "registration is closed by a switch; open it for the seed run",
  "auth.email_invalid": "SEED_EMAIL is not a valid email",
  "auth.password_too_short": "SEED_PASSWORD is shorter than password.minLength",
  "auth.password_too_long": "SEED_PASSWORD is longer than the module accepts",
  "auth.consent_required": "registration requires consent",
};

const consoleOutput: CliOutput = {
  log: (line) => console.log(line),
  error: (line) => console.error(line),
};

/**
 * Creates the development account and returns the exit code: 0 created or already there, 1 refused
 * or failed (nothing written), 2 `SEED_EMAIL` or `SEED_PASSWORD` missing.
 */
export async function runSeedAccount(options: RunSeedAccountOptions): Promise<number> {
  const env = options.env ?? process.env;
  const output = options.output ?? consoleOutput;
  const email = env.SEED_EMAIL?.trim() ?? "";
  const password = env.SEED_PASSWORD ?? "";
  if (email === "" || password.trim() === "") {
    output.error(`${NAME}: set SEED_EMAIL and SEED_PASSWORD to the development account's email and password`);
    return EXIT_USAGE;
  }
  if (env.NODE_ENV === "production") {
    output.error(`${NAME}: refused: NODE_ENV is production; the seed account is for development`);
    return EXIT_FAILED;
  }

  const opened = await openDatabase(options);
  if (!opened.ok) {
    output.error(`${NAME}: ${opened.message}`);
    return EXIT_FAILED;
  }
  try {
    const ctx: AuthContext = { db: opened.db, clock: options.clock ?? systemClock, config: options.config };
    const registered = await registerUser(ctx, { email, password, hasConsented: true, clientKey: SEED_CLIENT_KEY });
    if (registered.ok) {
      // Registration signs the account in; the seed only wants the account.
      await logoutSession(ctx, registered.value.session.token);
      output.log(`${NAME}: created the account ${registered.value.user.email}`);
      return EXIT_OK;
    }
    if (registered.error === "auth.email_taken") {
      output.log(`${NAME}: ${normalizeEmail(email)} is already there; nothing changed`);
      return EXIT_OK;
    }
    const reason = registered.error === "security.rate_limited" ? "too many registrations from the seed; wait and run it again" : REFUSALS[registered.error];
    output.error(`${NAME}: refused: ${reason} (${registered.error})`);
    return EXIT_FAILED;
  } catch (error) {
    output.error(`${NAME}: failed: ${describeFailure(error)}`);
    return EXIT_FAILED;
  } finally {
    await opened.close();
  }
}

type OpenedDatabase = { readonly ok: true; readonly db: Database; readonly close: () => Promise<void> } | { readonly ok: false; readonly message: string };

async function openDatabase(options: RunSeedAccountOptions): Promise<OpenedDatabase> {
  if (options.database !== undefined) return { ok: true, db: options.database, close: () => Promise.resolve() };
  if (options.config.database === null) return { ok: false, message: "the config has no database; set database.url in softure.config" };
  try {
    const opened = await openCommandDatabase(options.config.database, { max: 1 });
    return { ok: true, db: opened.handle.db, close: opened.close };
  } catch (error) {
    return { ok: false, message: `could not open the database: ${describeFailure(error)}` };
  }
}

/** The error message, except for database errors, whose message may carry query parameters (the password hash). */
function describeFailure(error: unknown): string {
  if (safeError(error).error === "core.database_failed") return `database error (${errorLogLabel(error)})`;
  return error instanceof Error ? error.message : String(error);
}
