// Importing a sign-up list an app kept before it adopted the module: the rows with their history
// (sign-up time, the original id, the channel), the consent evidence at the time it was given, and
// the opt-out of the ones who unsubscribed. The whole input is checked before anything is written and
// the writes run in one transaction, so an import lands whole or not at all. A repeat import changes
// nothing: rows are matched by address, scopes only widen, and a consent record already in the ledger
// (same purpose, grant or withdrawal, time) is not recorded again. No rate limit, no mail and no
// `onJoined`: this is history, not a new sign-up. Problems name row numbers, never an address.
import { err, ok, type Err, type Ok } from "@softure-ai/core";
import type { WaitlistImportErrorCode } from "../contract.js";
import { getRecipientKey, isSuppressed, readUnsubscribeSecrets, signRecipientKey, unsubscribe, type Env } from "@softure-ai/mailing/server";
import { findLegalDocument, getConsent, importConsent, listConsents } from "@softure-ai/privacy/server";
import { eq, inArray } from "drizzle-orm";
import { signups } from "../schema.js";
import { getWaitlistOptions } from "./options.js";
import { getWidenedScopes, isChannel, normalizeEmail, type SignupRow, type WaitlistContext } from "./signups.js";

/** The `source` of the consents and withdrawals an import records. */
export const IMPORT_CONSENT_SOURCE = "waitlist-import";
/** The most rows one import takes; split a larger list. */
export const MAX_IMPORT_ROWS = 50_000;
/** The most problems a refusal lists. */
const MAX_LISTED_PROBLEMS = 10;

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const LOCALE_PATTERN = /^[a-z]{2}$/;
/** A document version as privacy accepts it from an import. */
const DOCUMENT_VERSION_PATTERN = /^[!-~]{1,64}$/;

/** One sign-up of the app's own list. */
export interface ImportSignupRow {
  /** The row's id in the app's list, kept when the app's old unsubscribe links carry it; a UUID. */
  readonly id?: string;
  readonly email: string;
  /** Scope ids of `waitlist({ scopes })`, at least one; map the app's own names before. */
  readonly scopes: readonly string[];
  /** One of `waitlist({ placements })`. */
  readonly placement: string;
  /** Two letters, e.g. `pl`: the language of its mail. */
  readonly locale: string;
  /** When the person signed up: the row's `created_at`. */
  readonly signedUpAt: Date;
  /** When it started to count; `signedUpAt` by default (a list without double opt-in). */
  readonly confirmedAt?: Date;
  /** When the consents were given; `confirmedAt` by default. */
  readonly consentedAt?: Date;
  /** The version of each document (id → version) the person agreed to, when it is not the configured one. */
  readonly documentVersions?: Readonly<Record<string, string>>;
  /** The acquisition channel, 1-64 visible ASCII characters. */
  readonly channel?: string | null;
  /** When the person unsubscribed, if they did. */
  readonly unsubscribedAt?: Date | null;
}

export interface ImportSignupsOptions {
  /** Where `MAILING_UNSUBSCRIBE_SECRET` is read, for the opt-outs of unsubscribed rows; `process.env` by default. */
  readonly env?: Env;
}

/** What an import changed. */
export interface ImportSignupsSummary {
  readonly rows: number;
  /** Addresses that were not on the list. */
  readonly inserted: number;
  /** Addresses already on the list whose scopes, times or channel changed. */
  readonly updated: number;
  /** Addresses already on the list exactly as imported. */
  readonly unchanged: number;
  /** Granted consents recorded at their historical time. */
  readonly consentsRecorded: number;
  /** Withdrawals recorded at the time of the unsubscribe. */
  readonly withdrawalsRecorded: number;
  /** Addresses that got a mailing opt-out. */
  readonly optOutsRecorded: number;
}

export type ImportSignupsRefusal = Err<WaitlistImportErrorCode> & {
  /** What is wrong, by row number (from 1); never an address. */
  readonly problems: readonly string[];
};

export type ImportSignupsResult = Ok<ImportSignupsSummary> | ImportSignupsRefusal;

/** A row after the checks: normalised, scopes in the config's order, every time filled in. */
interface CheckedRow {
  readonly number: number;
  readonly id: string | null;
  readonly email: string;
  readonly scopes: readonly string[];
  readonly placement: string;
  readonly locale: string;
  readonly signedUpAt: Date;
  readonly confirmedAt: Date;
  readonly consentedAt: Date;
  readonly documentVersions: Readonly<Record<string, string>>;
  readonly channel: string | null;
  readonly unsubscribedAt: Date | null;
}

function refuse(problems: readonly string[]): ImportSignupsRefusal {
  const listed = problems.slice(0, MAX_LISTED_PROBLEMS);
  if (problems.length > MAX_LISTED_PROBLEMS) listed.push(`and ${String(problems.length - MAX_LISTED_PROBLEMS)} more problems`);
  return { ...err("waitlist.import_invalid"), problems: listed };
}

const isTime = (value: unknown): value is Date => value instanceof Date && !Number.isNaN(value.getTime());

/** The row's problems, or the row ready to write. */
function checkRow(ctx: WaitlistContext, row: ImportSignupRow, number: number): CheckedRow | string[] {
  const options = getWaitlistOptions(ctx.config);
  const now = ctx.clock.now();
  const at = `row ${String(number)}`;
  const problems: string[] = [];

  const email = normalizeEmail(row.email);
  if (email === null) problems.push(`${at}: email is not an email address`);
  if (row.id !== undefined && !UUID_PATTERN.test(row.id)) problems.push(`${at}: id is not a UUID`);

  const declared = options.scopes.map((scope) => scope.id);
  const unknownScopes = row.scopes.filter((id) => !declared.includes(id));
  if (row.scopes.length === 0) problems.push(`${at}: scopes is empty`);
  if (unknownScopes.length > 0) problems.push(`${at}: scopes ${unknownScopes.map((id) => `"${id}"`).join(", ")} are not declared in waitlist({ scopes })`);
  if (!options.placements.includes(row.placement)) problems.push(`${at}: placement "${row.placement}" is not declared in waitlist({ placements })`);
  if (!LOCALE_PATTERN.test(row.locale)) problems.push(`${at}: locale must be two lowercase letters`);
  if (row.channel != null && !isChannel(row.channel)) problems.push(`${at}: channel must be 1-64 visible ASCII characters`);

  const signedUpAt = row.signedUpAt;
  const confirmedAt = row.confirmedAt ?? signedUpAt;
  const consentedAt = row.consentedAt ?? confirmedAt;
  const unsubscribedAt = row.unsubscribedAt ?? null;
  // Only the times the row gives: a default repeats a time already checked.
  const times: [string, Date | null | undefined][] = [
    ["signedUpAt", row.signedUpAt],
    ["confirmedAt", row.confirmedAt],
    ["consentedAt", row.consentedAt],
    ["unsubscribedAt", row.unsubscribedAt],
  ];
  const badTimes = times.filter(([, time]) => time != null && (!isTime(time) || time > now)).map(([name]) => name);
  if (badTimes.length > 0) {
    problems.push(`${at}: ${badTimes.join(", ")} must be a valid time, not after now`);
  } else {
    if (confirmedAt < signedUpAt) problems.push(`${at}: confirmedAt is before signedUpAt`);
    if (consentedAt < signedUpAt) problems.push(`${at}: consentedAt is before signedUpAt`);
    if (unsubscribedAt !== null && unsubscribedAt < consentedAt) problems.push(`${at}: unsubscribedAt is before consentedAt`);
  }

  const documentVersions = row.documentVersions ?? {};
  for (const [document, version] of Object.entries(documentVersions)) {
    if (findLegalDocument(ctx.config, document) === undefined) problems.push(`${at}: documentVersions names "${document}", which privacy({ documents }) does not declare`);
    else if (!DOCUMENT_VERSION_PATTERN.test(version)) problems.push(`${at}: documentVersions.${document} must be 1-64 visible ASCII characters`);
  }

  if (problems.length > 0 || email === null) return problems;
  const requested = new Set(row.scopes);
  return {
    number,
    id: row.id?.toLowerCase() ?? null,
    email,
    scopes: declared.filter((id) => requested.has(id)),
    placement: row.placement,
    locale: row.locale,
    signedUpAt,
    confirmedAt,
    consentedAt,
    documentVersions,
    channel: row.channel ?? null,
    unsubscribedAt,
  };
}

/** Row numbers of values seen earlier in the input. */
function findRepeats(rows: readonly CheckedRow[], key: (row: CheckedRow) => string | null): number[] {
  const seen = new Set<string>();
  const repeated: number[] = [];
  for (const row of rows) {
    const value = key(row);
    if (value === null) continue;
    if (seen.has(value)) repeated.push(row.number);
    seen.add(value);
  }
  return repeated;
}

/**
 * Imports the app's own sign-up list (see the file header). Refuses the whole input with its problems
 * when any row is invalid, an email or id repeats, a row's id belongs to another address, an address
 * is stored under another id, or a row unsubscribed and `MAILING_UNSUBSCRIBE_SECRET` is not set.
 * Database errors propagate (nothing is written).
 */
export async function importSignups(ctx: WaitlistContext, rows: readonly ImportSignupRow[], options: ImportSignupsOptions = {}): Promise<ImportSignupsResult> {
  if (rows.length === 0) return refuse(["the input holds no rows"]);
  if (rows.length > MAX_IMPORT_ROWS) return refuse([`the input holds more than ${String(MAX_IMPORT_ROWS)} rows; split it`]);

  const checked: CheckedRow[] = [];
  const problems: string[] = [];
  rows.forEach((row, index) => {
    const result = checkRow(ctx, row, index + 1);
    if (Array.isArray(result)) problems.push(...result);
    else checked.push(result);
  });
  const repeatedEmails = findRepeats(checked, (row) => row.email);
  if (repeatedEmails.length > 0) problems.push(`rows ${repeatedEmails.join(", ")} repeat an email named earlier`);
  const repeatedIds = findRepeats(checked, (row) => row.id);
  if (repeatedIds.length > 0) problems.push(`rows ${repeatedIds.join(", ")} repeat an id named earlier`);
  const secret = readUnsubscribeSecrets(options.env).current;
  if (secret === null && checked.some((row) => row.unsubscribedAt !== null)) {
    problems.push("MAILING_UNSUBSCRIBE_SECRET is not set (at least 32 characters): the unsubscribed rows need it for their opt-out");
  }
  if (problems.length > 0) return refuse(problems);

  return ctx.db.transaction(async (tx) => {
    const txCtx: WaitlistContext = { ...ctx, db: tx };
    const clashes = await findIdClashes(txCtx, checked);
    if (clashes.length > 0) return refuse(clashes);

    const summary = { rows: checked.length, inserted: 0, updated: 0, unchanged: 0, consentsRecorded: 0, withdrawalsRecorded: 0, optOutsRecorded: 0 };
    for (const row of checked) {
      const outcome = await writeRow(txCtx, row);
      summary[outcome] += 1;
      const recorded = await recordHistory(txCtx, row);
      summary.consentsRecorded += recorded.consents;
      summary.withdrawalsRecorded += recorded.withdrawals;
      // The secret was checked above for every unsubscribed row.
      if (row.unsubscribedAt !== null && secret !== null && (await optOut(txCtx, row.email, secret))) summary.optOutsRecorded += 1;
    }
    return ok(summary);
  });
}

/** Rows whose id is another address's, or whose address is stored under another id. */
async function findIdClashes(ctx: WaitlistContext, rows: readonly CheckedRow[]): Promise<string[]> {
  const problems: string[] = [];
  const BATCH = 1000;
  for (let start = 0; start < rows.length; start += BATCH) {
    const batch = rows.slice(start, start + BATCH);
    const ids = batch.flatMap((row) => (row.id === null ? [] : [row.id]));
    const byId = new Map<string, string>();
    if (ids.length > 0) {
      for (const stored of await ctx.db.select({ id: signups.id, email: signups.email }).from(signups).where(inArray(signups.id, ids))) byId.set(stored.id, stored.email);
    }
    const byEmail = new Map<string, string>();
    for (const stored of await ctx.db.select({ id: signups.id, email: signups.email }).from(signups).where(inArray(signups.email, batch.map((row) => row.email)))) byEmail.set(stored.email, stored.id);
    for (const row of batch) {
      if (row.id === null) continue;
      const owner = byId.get(row.id);
      if (owner !== undefined && owner !== row.email) problems.push(`row ${String(row.number)}: id belongs to another address on the list`);
      const storedId = byEmail.get(row.email);
      if (storedId !== undefined && storedId !== row.id) problems.push(`row ${String(row.number)}: the address is on the list under another id`);
    }
  }
  return problems;
}

const earlier = (a: Date, b: Date): Date => (a <= b ? a : b);

/** Inserts the row, or merges it into the stored one (scopes only widen, times only move back). */
async function writeRow(ctx: WaitlistContext, row: CheckedRow): Promise<"inserted" | "updated" | "unchanged"> {
  const now = ctx.clock.now();
  const [inserted] = await ctx.db
    .insert(signups)
    .values({
      ...(row.id === null ? {} : { id: row.id }),
      email: row.email,
      scopes: [...row.scopes],
      placement: row.placement,
      locale: row.locale,
      createdAt: row.signedUpAt,
      updatedAt: now,
      confirmedAt: row.confirmedAt,
      channel: row.channel,
    })
    .onConflictDoNothing({ target: signups.email })
    .returning();
  if (inserted !== undefined) return "inserted";

  const [current] = await ctx.db.select().from(signups).where(eq(signups.email, row.email)).for("update");
  // The insert just conflicted on this address, and nothing else in this transaction deletes rows.
  if (current === undefined) throw new Error("@softure-ai/waitlist: a sign-up vanished while it was being imported");
  const next = getMergedRow(ctx, current, row);
  if (next === null) return "unchanged";
  const [updated] = await ctx.db
    .update(signups)
    .set({ ...next, updatedAt: now })
    .where(eq(signups.id, current.id))
    .returning();
  if (updated === undefined) throw new Error("@softure-ai/waitlist: updating a locked sign-up changed no row");
  return "updated";
}

/** The columns that change when `row` is merged into `current`, or null when none does. */
function getMergedRow(ctx: WaitlistContext, current: SignupRow, row: CheckedRow): Pick<SignupRow, "scopes" | "createdAt" | "confirmedAt" | "channel"> | null {
  // An unconfirmed row's scopes were only requested; the imported ones were granted.
  const scopes = current.confirmedAt === null ? [...row.scopes] : getWidenedScopes(ctx, current.scopes, row.scopes);
  const createdAt = earlier(current.createdAt, row.signedUpAt);
  const confirmedAt = current.confirmedAt === null ? row.confirmedAt : earlier(current.confirmedAt, row.confirmedAt);
  const channel = current.channel ?? row.channel;
  const isUnchanged =
    scopes.length === current.scopes.length &&
    scopes.every((scope, index) => current.scopes[index] === scope) &&
    createdAt.getTime() === current.createdAt.getTime() &&
    confirmedAt.getTime() === current.confirmedAt?.getTime() &&
    channel === current.channel;
  return isUnchanged ? null : { scopes, createdAt, confirmedAt, channel };
}

/** Records the row's consents (and withdrawals) at their times, skipping records already in the ledger. */
async function recordHistory(ctx: WaitlistContext, row: CheckedRow): Promise<{ consents: number; withdrawals: number }> {
  const subject = { email: row.email };
  const ledger = await listConsents(ctx, subject);
  const isRecorded = (purpose: string, granted: boolean, at: Date) =>
    ledger.some((record) => record.purpose === purpose && record.granted === granted && record.recordedAt.getTime() === at.getTime());
  const declared = getWaitlistOptions(ctx.config).scopes;
  const recorded = { consents: 0, withdrawals: 0 };
  for (const purpose of row.scopes) {
    if (!isRecorded(purpose, true, row.consentedAt)) {
      const document = declared.find((scope) => scope.id === purpose)?.document;
      const documentVersion = document === undefined ? undefined : row.documentVersions[document];
      const result = await importConsent(ctx, {
        subject,
        purpose,
        granted: true,
        source: IMPORT_CONSENT_SOURCE,
        recordedAt: row.consentedAt,
        ...(document === undefined ? {} : { document }),
        ...(documentVersion === undefined ? {} : { documentVersion }),
      });
      // checkRow verified the address, the scope, the time, the document and its version.
      if (!result.ok) throw new Error(`@softure-ai/waitlist: importing consent to "${purpose}" failed with ${result.error}`);
      recorded.consents += 1;
    }
    if (row.unsubscribedAt !== null && !isRecorded(purpose, false, row.unsubscribedAt)) {
      const result = await importConsent(ctx, { subject, purpose, granted: false, source: IMPORT_CONSENT_SOURCE, recordedAt: row.unsubscribedAt });
      if (!result.ok) throw new Error(`@softure-ai/waitlist: importing the withdrawal of "${purpose}" failed with ${result.error}`);
      recorded.withdrawals += 1;
    }
  }
  return recorded;
}

/**
 * Opts the address out of list mail the way its own unsubscribe would (a `page` opt-out, which a new
 * sign-up lifts once its confirmation link is used), when no scope of its sign-up is granted any
 * more and it is not opted out yet. Goes through mailing's `unsubscribe` with a link signed now, so
 * the app's `onUnsubscribed` runs as for any unsubscribe. Returns whether an opt-out was recorded.
 */
async function optOut(ctx: WaitlistContext, email: string, secret: string): Promise<boolean> {
  const [row] = await ctx.db.select({ scopes: signups.scopes }).from(signups).where(eq(signups.email, email));
  for (const purpose of row?.scopes ?? []) {
    const state = await getConsent(ctx, { subject: { email }, purpose });
    // Granted again later (a sign-up after the unsubscribe): the person wants the mail.
    if (state?.granted === true) return false;
  }
  if (await isSuppressed(ctx, email)) return false;
  const recipientKey = getRecipientKey(email);
  const token = { recipientKey, signature: signRecipientKey(recipientKey, secret) };
  const result = await unsubscribe(ctx, token, "page", { MAILING_UNSUBSCRIBE_SECRET: secret });
  // The token was signed with the secret it is verified against.
  if (!result.ok) throw new Error(`@softure-ai/waitlist: recording an imported opt-out failed with ${result.error}`);
  return true;
}
