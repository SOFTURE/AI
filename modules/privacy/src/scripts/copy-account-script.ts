// The operator's way to copy one account between databases: `copyAccount` as a safe ops script
// (`@softure-ai/ops/scripts`). It runs in the app's own database, the target, inside the ops
// transaction: a dry run copies and verifies everything there and rolls it back, `--commit` keeps
// it. The source comes as `--from` (or `--from-file`, so its password stays off the command line)
// and is only read. Reports carry the user id and row counts, never the email.
import { users } from "@softure-ai/auth";
import { ok } from "@softure-ai/core";
import { createDatabase, type Queryable } from "@softure-ai/db";
import { defineOpsScript, refuseOpsScript, type OpsScript } from "@softure-ai/ops/scripts";
import { eq, sql } from "drizzle-orm";
import { z } from "zod";
import { copyAccount, type CopyAccountInput } from "../server/copy-account.js";

export interface CopyAccountScriptArgs {
  readonly from: string;
  readonly user?: string;
  readonly email?: string;
}

/** An open source database and how to close it. */
export interface CopyAccountSource {
  readonly db: Queryable;
  readonly close: () => Promise<void>;
}

export interface CopyAccountScriptOptions extends Pick<CopyAccountInput, "exclude" | "include" | "onMissingReference"> {
  /** Opens the source database from `--from`; `createDatabase` from `@softure-ai/db` with one connection by default. */
  readonly openSource?: (url: string) => Promise<CopyAccountSource>;
}

const USER_HINT = "give --user=<account id> or --email=<account email>";

const copyAccountScriptArgs = z
  .strictObject({
    from: z.string({ error: "--from=<source database URL> is required" }).min(1, "--from=<source database URL> is required"),
    user: z.string().min(1, USER_HINT).optional(),
    email: z.string().min(1, USER_HINT).optional(),
  })
  .superRefine((args, context) => {
    if (args.user === undefined && args.email === undefined) context.addIssue({ code: "custom", path: ["user"], message: USER_HINT });
    if (args.user !== undefined && args.email !== undefined) context.addIssue({ code: "custom", path: ["user"], message: `${USER_HINT}, not both` });
  });

const USAGE = [
  "--from=<source database URL>  the database to copy from, only read",
  "--user=<account id>           the account to copy, or",
  "--email=<account email>       the account to copy, found by its email in the source",
];

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

/**
 * `copy-account --from=… --user=…|--email=…`: copies one account, with every row it owns, from the
 * source database into the app's database (README section 11, "Copying an account").
 */
export function createCopyAccountScript(options: CopyAccountScriptOptions = {}): OpsScript<CopyAccountScriptArgs> {
  const openSource = options.openSource ?? openSourceDatabase;
  return defineOpsScript({
    name: "copy-account",
    description:
      "Copies one account, with every row it owns, from the --from database into the app's database. " +
      "A dry run may still move identity sequences of the target past the copied ids.",
    usage: USAGE,
    args: copyAccountScriptArgs,
    secrets: ["from"],
    run: async (tx, args) => {
      const source = await openSource(args.from);
      try {
        const userId = args.user ?? (await findAccountId(source.db, args.email ?? ""));
        if (userId === undefined) return refuseOpsScript("no account in the source has this email");
        const before = { userId, isInTarget: await isInTarget(tx, userId) };
        // The ops transaction decides whether the copy is kept, so the copy itself always commits.
        const copied = await copyAccount({
          from: source.db,
          to: tx,
          userId,
          commit: true,
          exclude: options.exclude,
          include: options.include,
          onMissingReference: options.onMissingReference,
        });
        if (!copied.ok) return refuseOpsScript(`${copied.error}: ${copied.detail}`);
        return ok({ before, after: { userId, isInTarget: await isInTarget(tx, userId), tables: copied.value.tables } });
      } finally {
        await source.close();
      }
    },
  });
}
