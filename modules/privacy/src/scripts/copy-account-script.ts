// The operator's way to copy one account between databases: `copyAccount` as a safe ops script
// (`@softure-ai/ops/scripts`). The target is the app's own database, inside the ops transaction, or
// the database at `--to`, inside a transaction of its own that follows the ops dry run: a dry run
// copies and verifies everything there and rolls it back, `--commit` keeps it. The source comes as
// `--from` and is only read. Both URLs may come from files (`--from-file`, `--to-file`), so their
// passwords stay off the command line. Reports carry the user id and row counts, never the email.
import { users } from "@softure-ai/auth";
import { ok, type Ok } from "@softure-ai/core";
import { createDatabase, type Queryable } from "@softure-ai/db";
import { defineOpsScript, refuseOpsScript, type OpsRefusal, type OpsReport, type OpsRunContext, type OpsScript } from "@softure-ai/ops/scripts";
import { eq, sql } from "drizzle-orm";
import { z } from "zod";
import { copyAccount, type CopyAccountInput } from "../server/copy-account.js";

export interface CopyAccountScriptArgs {
  readonly from: string;
  readonly to?: string;
  readonly user?: string;
  readonly email?: string;
  readonly newEmail?: string;
}

/** An open database and how to close it. */
export interface CopyAccountSource {
  readonly db: Queryable;
  readonly close: () => Promise<void>;
}

export interface CopyAccountScriptOptions extends Pick<CopyAccountInput, "exclude" | "include" | "onMissingReference" | "ledger"> {
  /** Opens the source database from `--from`; `createDatabase` from `@softure-ai/db` with one connection by default. */
  readonly openSource?: (url: string) => Promise<CopyAccountSource>;
  /** Opens the target database from `--to`; the same default as `openSource`. */
  readonly openTarget?: (url: string) => Promise<CopyAccountSource>;
}

const USER_HINT = "give --user=<account id> or --email=<account email>";

const copyAccountScriptArgs = z
  .strictObject({
    from: z.string({ error: "--from=<source database URL> is required" }).min(1, "--from=<source database URL> is required"),
    to: z.string().min(1, "--to=<target database URL> needs a value").optional(),
    user: z.string().min(1, USER_HINT).optional(),
    email: z.string().min(1, USER_HINT).optional(),
    "new-email": z.email("--new-email=<address> needs an email address").optional(),
  })
  .superRefine((args, context) => {
    if (args.user === undefined && args.email === undefined) context.addIssue({ code: "custom", path: ["user"], message: USER_HINT });
    if (args.user !== undefined && args.email !== undefined) context.addIssue({ code: "custom", path: ["user"], message: `${USER_HINT}, not both` });
    if (args.to !== undefined && args.to === args.from) context.addIssue({ code: "custom", path: ["to"], message: "--to names the --from database" });
  })
  .transform(({ "new-email": newEmail, ...rest }): CopyAccountScriptArgs => (newEmail === undefined ? rest : { ...rest, newEmail }));

const USAGE = [
  "--from=<source database URL>  the database to copy from, only read",
  "--to=<target database URL>    the database to copy into; the app's database when left out",
  "--user=<account id>           the account to copy, or",
  "--email=<account email>       the account to copy, found by its email in the source",
  "--new-email=<address>         the email the account gets in the target",
];

/** Copies into `target` and measures it there, before and after. */
type CopyRun = (target: Queryable) => Promise<Ok<OpsReport> | OpsRefusal>;

async function openSourceDatabase(url: string): Promise<CopyAccountSource> {
  const handle = await createDatabase(url, { max: 1 });
  return { db: handle.db, close: handle.close };
}

async function findAccountId(db: Queryable, email: string): Promise<string | undefined> {
  const [row] = await db.select({ id: users.id }).from(users).where(eq(users.email, email.trim().toLowerCase())).limit(1);
  return row?.id;
}

async function isInTarget(tx: Queryable, userId: string): Promise<boolean> {
  const result = await tx.execute<{ found: boolean }>(sql`SELECT EXISTS (SELECT 1 FROM auth.users WHERE id::text = ${userId}) AS found`);
  return result.rows[0]?.found === true;
}

/** Thrown inside the `--to` transaction to roll it back, carrying the outcome; never leaves `copyIntoTarget`. */
class TargetRollback extends Error {
  constructor(readonly outcome: Ok<OpsReport> | OpsRefusal) {
    super("copy-account: target rolled back");
    this.name = "TargetRollback";
  }
}

/**
 * Runs the copy in one transaction on the `--to` database, kept only when the ops run commits and
 * the copy succeeded: the same dry run the app's database gets from the ops transaction.
 */
async function copyIntoTarget(target: Queryable, context: OpsRunContext, run: CopyRun): Promise<Ok<OpsReport> | OpsRefusal> {
  try {
    return await target.transaction(async (tx) => {
      const outcome = await run(tx);
      if (!outcome.ok || !context.commit) throw new TargetRollback(outcome);
      return outcome;
    });
  } catch (error) {
    if (error instanceof TargetRollback) return error.outcome;
    throw error;
  }
}

/**
 * `copy-account --from=… [--to=…] --user=…|--email=… [--new-email=…]`: copies one account, with
 * every row it owns, from the source database into the app's database or the `--to` database
 * (README section 11, "Copying an account").
 */
export function createCopyAccountScript(options: CopyAccountScriptOptions = {}): OpsScript<CopyAccountScriptArgs> {
  const openSource = options.openSource ?? openSourceDatabase;
  const openTarget = options.openTarget ?? openSourceDatabase;
  return defineOpsScript({
    name: "copy-account",
    description:
      "Copies one account, with every row it owns, from the --from database into the app's database or the --to database. " +
      "A dry run may still move identity sequences of the target past the copied ids.",
    usage: USAGE,
    args: copyAccountScriptArgs,
    secrets: ["from", "to"],
    // `context` is undefined under an ops helper that predates the run context.
    run: async (tx, args, context?: OpsRunContext) => {
      if (args.to !== undefined && context === undefined) {
        return refuseOpsScript("--to needs an @softure-ai/ops that passes the run context to scripts; update @softure-ai/ops");
      }
      const source = await openSource(args.from);
      try {
        const userId = args.user ?? (await findAccountId(source.db, args.email ?? ""));
        if (userId === undefined) return refuseOpsScript("no account in the source has this email");
        // The surrounding transaction decides whether the copy is kept, so the copy itself always commits.
        const run: CopyRun = async (target) => {
          const before = { userId, isInTarget: await isInTarget(target, userId) };
          const copied = await copyAccount({
            from: source.db,
            to: target,
            userId,
            commit: true,
            newEmail: args.newEmail,
            exclude: options.exclude,
            include: options.include,
            onMissingReference: options.onMissingReference,
            ledger: options.ledger,
          });
          if (!copied.ok) return refuseOpsScript(`${copied.error}: ${copied.detail}`);
          return ok({ before, after: { userId, isInTarget: await isInTarget(target, userId), tables: copied.value.tables } });
        };
        if (args.to === undefined || context === undefined) return await run(tx);
        const target = await openTarget(args.to);
        try {
          return await copyIntoTarget(target.db, context, run);
        } finally {
          await target.close();
        }
      } finally {
        await source.close();
      }
    },
  });
}
