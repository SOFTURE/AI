// Seeds the delivery ledger with deliveries an app made before it adopted the module, so `deliverOnce` and
// campaigns skip them. Every row is checked before anything is written; a row whose scope and recipient are
// already in the ledger is left as it is (the ledger wins, and a live claim keeps its fence), so a re-run imports
// nothing twice.
import { isMailKind, isSingleAddress } from "../address.js";
import { TRANSACTIONAL_KIND, type MailingErrorCode } from "../contract.js";
import { deliveries } from "../schema.js";
import { isDeliveryScope, type DeliveryContext } from "./deliveries.js";
import { getRecipientKey } from "./unsubscribe-link.js";

/** The reasons a rejected row may carry: the codes `deliverOnce` closes a row with. */
export type ImportedRejectionReason = Extract<MailingErrorCode, "mailing.invalid_input" | "mailing.rejected" | "mailing.unavailable" | "mailing.suppressed">;

const REJECTION_REASONS: ReadonlySet<string> = new Set<ImportedRejectionReason>(["mailing.invalid_input", "mailing.rejected", "mailing.unavailable", "mailing.suppressed"]);

/** Rows written per statement. */
const BATCH_SIZE = 500;

export interface ImportedDelivery {
  /** The scope `deliverOnce` will use for this mail: `campaign:<id>` for a campaign, else e.g. `billing.trial-ending:sub_42`. */
  readonly scope: string;
  /** The recipient's address; only its key is stored (any case or spacing gives the same key). */
  readonly address: string;
  readonly status: "sent" | "rejected";
  /** When the delivery was closed; a `Date` or an ISO 8601 string, not in the future. */
  readonly finishedAt: Date | string;
  /** The provider's message id, when the app kept it. Only on `sent`. */
  readonly providerMessageId?: string;
  /** Why a rejected delivery is final. Only on `rejected`; default `mailing.rejected`. */
  readonly reason?: ImportedRejectionReason;
  /** The mail kind. Default `transactional`. */
  readonly kind?: string;
}

export interface ImportProblem {
  /** The row's index in the input (0-based). */
  readonly index: number;
  /** What is wrong, naming the field; never the address. */
  readonly problem: string;
}

export interface ImportSummary {
  /** Rows given. */
  readonly rows: number;
  /** Rows written now. */
  readonly imported: number;
  /** Rows whose scope and recipient the ledger already had (from an earlier import or a send); left as they were. */
  readonly alreadyPresent: number;
  /** Rows with the scope and recipient of an earlier row in the input; the first one counts. */
  readonly duplicates: number;
}

/** The import's answer: a summary, or every problem (and nothing written). */
export type ImportResult = { readonly ok: true; readonly value: ImportSummary } | { readonly ok: false; readonly problems: readonly ImportProblem[] };

/** The checked rows, ready for the ledger, or every problem. */
export type ImportCheck =
  | { readonly ok: true; readonly value: { readonly ledgerRows: readonly LedgerRow[]; readonly duplicates: number } }
  | { readonly ok: false; readonly problems: readonly ImportProblem[] };

type LedgerRow = typeof deliveries.$inferInsert;

/**
 * Writes `rows` into `mailing.deliveries` as closed deliveries. Returns the problems, and writes nothing, when any
 * row is invalid. Throws on a database failure; rows written before it stay, and a re-run skips them.
 */
export async function importDeliveries(ctx: DeliveryContext, rows: readonly ImportedDelivery[]): Promise<ImportResult> {
  const checked = checkImportedDeliveries(ctx, rows);
  if (!checked.ok) return checked;
  const { ledgerRows, duplicates } = checked.value;

  let imported = 0;
  for (let start = 0; start < ledgerRows.length; start += BATCH_SIZE) {
    const written = await ctx.db
      .insert(deliveries)
      .values(ledgerRows.slice(start, start + BATCH_SIZE))
      .onConflictDoNothing({ target: [deliveries.scope, deliveries.recipientKey] })
      .returning();
    imported += written.length;
  }
  return { ok: true, value: { rows: rows.length, imported, alreadyPresent: ledgerRows.length - imported, duplicates } };
}

/**
 * Checks every row and builds the ledger rows, without touching the database (e.g. for a dry run). The problems
 * cover every invalid row, not only the first.
 */
export function checkImportedDeliveries(
  ctx: Pick<DeliveryContext, "clock">,
  rows: readonly ImportedDelivery[],
): ImportCheck {
  const now = ctx.clock.now();
  const problems: ImportProblem[] = [];
  const ledgerRows: LedgerRow[] = [];
  const seen = new Set<string>();
  let duplicates = 0;
  rows.forEach((row, index) => {
    const rowProblems = findRowProblems(row, now);
    if (rowProblems.length > 0) {
      problems.push(...rowProblems.map((problem) => ({ index, problem })));
      return;
    }
    const recipientKey = getRecipientKey(row.address);
    const key = `${row.scope}\n${recipientKey}`;
    if (seen.has(key)) {
      duplicates += 1;
      return;
    }
    seen.add(key);
    const finishedAt = new Date(row.finishedAt);
    ledgerRows.push({
      scope: row.scope,
      recipientKey,
      kind: row.kind ?? TRANSACTIONAL_KIND,
      // Campaign rows are matched by scope; a campaign id would need the campaign's content, which history lacks.
      campaignId: null,
      status: row.status,
      attempts: 1,
      claimedAt: finishedAt,
      finishedAt,
      providerMessageId: row.status === "sent" ? (row.providerMessageId ?? null) : null,
      reason: row.status === "rejected" ? (row.reason ?? "mailing.rejected") : null,
      providerStatus: null,
      createdAt: now,
      importedAt: now,
    });
  });
  return problems.length > 0 ? { ok: false, problems } : { ok: true, value: { ledgerRows, duplicates } };
}

function findRowProblems(row: ImportedDelivery, now: Date): string[] {
  const problems: string[] = [];
  if (!isDeliveryScope(row.scope)) problems.push("scope must be lowercase letters, digits and ._:- (at most 128 characters)");
  if (!isSingleAddress(row.address.trim())) problems.push("address must be one email address");
  if (row.status !== "sent" && row.status !== "rejected") problems.push('status must be "sent" or "rejected"');
  const finishedAt = new Date(row.finishedAt);
  if (Number.isNaN(finishedAt.getTime())) problems.push("finishedAt must be a date");
  else if (finishedAt.getTime() > now.getTime()) problems.push("finishedAt must not be in the future");
  if (row.providerMessageId !== undefined) {
    if (row.status !== "sent") problems.push("providerMessageId belongs only to a sent row");
    else if (row.providerMessageId.trim() === "" || row.providerMessageId.length > 256) problems.push("providerMessageId must be 1 to 256 characters");
  }
  if (row.reason !== undefined) {
    if (row.status !== "rejected") problems.push("reason belongs only to a rejected row");
    else if (!REJECTION_REASONS.has(row.reason)) problems.push(`reason must be one of ${[...REJECTION_REASONS].join(", ")}`);
  }
  if (row.kind !== undefined && !isMailKind(row.kind)) problems.push("kind must be kebab-case (at most 64 characters)");
  return problems;
}
