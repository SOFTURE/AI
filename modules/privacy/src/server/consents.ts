// The consent ledger: recording a consent or its withdrawal, and reading the current state and the
// history of a subject. Rows are only ever inserted (the table refuses UPDATE); the current state
// of a purpose is its latest row.
import { createHash } from "node:crypto";
import { err, ok, type Err, type Ok } from "@softure-ai/core";
import { and, asc, desc, eq, type SQL } from "drizzle-orm";
import { z } from "zod";
import type { ConsentRecord, ConsentState, ConsentSubject } from "../contract.js";
import { CONTRIBUTOR_ID_PATTERN } from "../options.js";
import { consents } from "../schema.js";
import type { PrivacyContext } from "./context.js";
import { findLegalDocument } from "./legal-documents.js";

const MAX_NAME_LENGTH = 64;
const MAX_EMAIL_LENGTH = 254;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
/** A SHA-256 digest in unpadded base64url, the shape of every stored email key. */
const EMAIL_KEY = /^[A-Za-z0-9_-]{43}$/;
const emailSchema = z.email();

export interface RecordConsentInput {
  readonly subject: ConsentSubject;
  /** What the consent is for, kebab-case, e.g. `terms` or `newsletter`. */
  readonly purpose: string;
  /** True to give consent, false to withdraw it (a new row; the earlier one stays as evidence). */
  readonly granted: boolean;
  /** The id of a document declared in `privacy({ documents })`; its configured version is recorded. */
  readonly document?: string;
  /** Where the consent was given, kebab-case, e.g. `registration`, `waitlist`, `account`. */
  readonly source: string;
}

export type RecordConsentResult = Ok<ConsentRecord> | Err<"privacy.consent_invalid" | "privacy.document_unknown">;

export interface ConsentQuery {
  readonly subject: ConsentSubject;
  readonly purpose: string;
}

/** The key an email subject is stored under: base64url SHA-256 of the trimmed, lowercased address. */
export function getEmailKey(email: string): string {
  return createHash("sha256").update(email.trim().toLowerCase()).digest("base64url");
}

const isName = (value: string) => value.length <= MAX_NAME_LENGTH && CONTRIBUTOR_ID_PATTERN.test(value);

/** The subject's column values, or null when it cannot name anyone (not a UUID, an address or a key). */
function toSubjectColumns(subject: ConsentSubject): { userId: string; emailKey: null } | { userId: null; emailKey: string } | null {
  if ("userId" in subject) return UUID.test(subject.userId) ? { userId: subject.userId, emailKey: null } : null;
  if ("emailKey" in subject) return EMAIL_KEY.test(subject.emailKey) ? { userId: null, emailKey: subject.emailKey } : null;
  const email = subject.email.trim().toLowerCase();
  if (email.length > MAX_EMAIL_LENGTH || !emailSchema.safeParse(email).success) return null;
  return { userId: null, emailKey: getEmailKey(email) };
}

function matchSubject(subject: ConsentSubject): SQL | null {
  const columns = toSubjectColumns(subject);
  if (columns === null) return null;
  return columns.userId === null ? eq(consents.emailKey, columns.emailKey) : eq(consents.userId, columns.userId);
}

type ConsentRow = typeof consents.$inferSelect;

export function toConsentRecord(row: ConsentRow): ConsentRecord {
  return {
    purpose: row.purpose,
    granted: row.granted,
    document: row.documentId === null || row.documentVersion === null ? null : { id: row.documentId, version: row.documentVersion },
    source: row.source,
    recordedAt: row.recordedAt,
  };
}

/**
 * Records a consent at `recordedAt`. For `recordConsent` (the clock's now) and the registration
 * hook (the account's creation time).
 */
export async function insertConsent(ctx: PrivacyContext, input: RecordConsentInput, recordedAt: Date): Promise<RecordConsentResult> {
  const subject = toSubjectColumns(input.subject);
  if (subject === null || !isName(input.purpose) || !isName(input.source)) return err("privacy.consent_invalid");

  let document: { id: string; version: string } | null = null;
  if (input.document !== undefined) {
    const declared = findLegalDocument(ctx.config, input.document);
    if (declared === undefined) return err("privacy.document_unknown");
    document = { id: declared.id, version: declared.version };
  }

  const [row] = await ctx.db
    .insert(consents)
    .values({
      ...subject,
      purpose: input.purpose,
      granted: input.granted,
      documentId: document?.id ?? null,
      documentVersion: document?.version ?? null,
      source: input.source,
      recordedAt,
    })
    .returning();
  // An INSERT … RETURNING without a conflict clause returns its row or throws.
  if (row === undefined) throw new Error("@softure-ai/privacy: recording a consent returned no row");
  return ok(toConsentRecord(row));
}

/**
 * Records that `subject` gave (or withdrew) consent to `purpose`, now. With `document`, the
 * document's configured version is recorded with it. Database errors propagate.
 */
export function recordConsent(ctx: PrivacyContext, input: RecordConsentInput): Promise<RecordConsentResult> {
  return insertConsent(ctx, input, ctx.clock.now());
}

/** The current state of one purpose for one subject (its latest record), or null when none was recorded. */
export async function getConsent(ctx: PrivacyContext, query: ConsentQuery): Promise<ConsentState | null> {
  const subject = matchSubject(query.subject);
  if (subject === null) return null;
  const [row] = await ctx.db
    .select()
    .from(consents)
    .where(and(subject, eq(consents.purpose, query.purpose)))
    .orderBy(desc(consents.recordedAt), desc(consents.id))
    .limit(1);
  if (row === undefined) return null;
  const record = toConsentRecord(row);
  const isCurrentVersion = record.document === null || findLegalDocument(ctx.config, record.document.id)?.version === record.document.version;
  return { ...record, isCurrentVersion };
}

/** Whether the latest record of the purpose grants it, for the document version in force. */
export async function hasConsent(ctx: PrivacyContext, query: ConsentQuery): Promise<boolean> {
  const state = await getConsent(ctx, query);
  return state !== null && state.granted && state.isCurrentVersion;
}

/** Every record of the subject, oldest first: the evidence of what was given and withdrawn, when. */
export async function listConsents(ctx: PrivacyContext, subject: ConsentSubject): Promise<ConsentRecord[]> {
  const condition = matchSubject(subject);
  if (condition === null) return [];
  const rows = await ctx.db.select().from(consents).where(condition).orderBy(asc(consents.recordedAt), asc(consents.id));
  return rows.map(toConsentRecord);
}
