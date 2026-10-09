// The options an app passes to `privacy({ ... })` in softure.config.ts, parsed at startup.
import { isCalendarDay, type PrivacyContributor } from "@softure-ai/core";
import { z } from "zod";

/** Kebab-case, like a module id: contributor ids are the keys of the export. */
export const CONTRIBUTOR_ID_PATTERN = /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/;

/** A document version as the app writes it, e.g. `2026-10-01` or `1.2`. */
export const DOCUMENT_VERSION_PATTERN = /^[0-9A-Za-z][0-9A-Za-z._-]{0,31}$/;

const MEBIBYTE = 1024 * 1024;

/** The export size limit when the app sets none. */
export const DEFAULT_EXPORT_MAX_BYTES = 10 * MEBIBYTE;

type ExportUserData = NonNullable<PrivacyContributor["exportUserData"]>;
type DeleteUserData = NonNullable<PrivacyContributor["deleteUserData"]>;

const isFunction = (value: unknown) => typeof value === "function";

const appContributorSchema = z
  .strictObject({
    /** Names the contributor's part of the export and its log lines, e.g. `profile`. */
    id: z.string().max(64, "must be at most 64 characters").regex(CONTRIBUTOR_ID_PATTERN, "must be kebab-case, e.g. user-profile"),
    /** The user's data held by the app, as plain JSON values (dates become ISO strings). */
    exportUserData: z.custom<ExportUserData>(isFunction, "must be a function").optional(),
    /** Deletes (or anonymises) that data. An `Err` refuses the deletion of the whole account. */
    deleteUserData: z.custom<DeleteUserData>(isFunction, "must be a function").optional(),
  })
  .refine((contributor) => contributor.exportUserData !== undefined || contributor.deleteUserData !== undefined, {
    message: "needs exportUserData, deleteUserData or both",
  });

const documentVersionSchema = z.string().regex(DOCUMENT_VERSION_PATTERN, "must be 1-32 letters, digits, '.', '_' or '-', e.g. 2026-10-01");

const legalRevisionSchema = z.strictObject({
  /** The calendar day this text takes effect, `YYYY-MM-DD`. */
  date: z.string().refine(isCalendarDay, "must be a calendar day, YYYY-MM-DD"),
  /** What changed, in a sentence the document's change history shows. */
  summary: z.string().refine((summary) => summary.trim() !== "", "must say what changed"),
  /** The version this text carries; the date when left out. */
  version: documentVersionSchema.optional(),
});

const legalDocumentSchema = z
  .strictObject({
    /** Names the document in consent records and in `getLegalDocument`, e.g. `terms`. */
    id: z.string().max(64, "must be at most 64 characters").regex(CONTRIBUTOR_ID_PATTERN, "must be kebab-case, e.g. privacy-policy"),
    /**
     * The version in force, stamped on every consent given to the document. Change it whenever the
     * published text changes, e.g. to the date the new text takes effect. With `history`, it is
     * derived from the newest entry and may be left out.
     */
    version: documentVersionSchema.optional(),
    /** Every published text, in any order: the version in force is the newest entry's. */
    history: z.array(legalRevisionSchema).optional(),
  })
  .superRefine((document, context) => {
    if (document.version === undefined && document.history === undefined) {
      context.addIssue({ code: "custom", path: [], message: "needs version, history or both" });
      return;
    }
    if (document.history === undefined) return;
    if (document.history.length === 0) {
      context.addIssue({ code: "custom", path: ["history"], message: "needs at least one entry, or leave it out and declare version" });
      return;
    }
    const dates = new Set<string>();
    document.history.forEach((entry, index) => {
      if (dates.has(entry.date)) {
        context.addIssue({ code: "custom", path: ["history", index, "date"], message: `"${entry.date}" is listed twice` });
      }
      dates.add(entry.date);
    });
    const newest = sortNewestFirst(document.history)[0];
    const derived = newest === undefined ? undefined : (newest.version ?? newest.date);
    if (document.version !== undefined && derived !== undefined && document.version !== derived) {
      context.addIssue({ code: "custom", path: ["version"], message: `must be the newest history entry's version, "${derived}"` });
    }
  })
  .transform(({ id, version, history = [] }) => {
    const revisions: readonly LegalDocumentRevision[] = sortNewestFirst(history).map((entry) => ({ version: entry.version ?? entry.date, date: entry.date, summary: entry.summary }));
    // The refinement guarantees a version or at least one entry.
    const current = version ?? (revisions[0] as { version: string }).version;
    return { id, version: current, history: revisions };
  });

/** One published text of a legal document, as the parsed config holds it. */
export interface LegalDocumentRevision {
  readonly version: string;
  /** `YYYY-MM-DD`, the day this text takes effect. */
  readonly date: string;
  readonly summary: string;
}

function sortNewestFirst<T extends { readonly date: string }>(entries: readonly T[]): T[] {
  return [...entries].sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
}

export const privacyOptionsSchema = z
  .strictObject({
    /**
     * The app's own contributors, next to the ones of its modules. They export after the modules
     * and delete before them, so app tables that reference module tables go first.
     */
    contributors: z.array(appContributorSchema).default([]),
    /** The app's legal documents (terms, privacy policy): their current versions, or their histories. */
    documents: z.array(legalDocumentSchema).default([]),
    export: z
      .strictObject({
        /** The largest export, in bytes of JSON; a larger one is refused instead of sent. */
        maxBytes: z
          .number()
          .int()
          .min(1024)
          .max(100 * MEBIBYTE)
          .default(DEFAULT_EXPORT_MAX_BYTES),
        /** The download's file name before the date, e.g. `account-data-2026-10-03.json`. */
        fileName: z.string().regex(/^[a-z0-9][a-z0-9-]{0,63}$/, "must be 1-64 lowercase letters, digits or -").default("account-data"),
      })
      .prefault({}),
  })
  .superRefine((options, context) => {
    const seen = new Set<string>();
    options.contributors.forEach((contributor, index) => {
      if (seen.has(contributor.id)) {
        context.addIssue({ code: "custom", path: ["contributors", index, "id"], message: `"${contributor.id}" is registered twice` });
      }
      seen.add(contributor.id);
    });
    const documentIds = new Set<string>();
    options.documents.forEach((document, index) => {
      if (documentIds.has(document.id)) {
        context.addIssue({ code: "custom", path: ["documents", index, "id"], message: `"${document.id}" is declared twice` });
      }
      documentIds.add(document.id);
    });
  });

export type PrivacyOptionsInput = z.input<typeof privacyOptionsSchema>;
export type PrivacyOptions = z.output<typeof privacyOptionsSchema>;
export type AppPrivacyContributor = PrivacyOptions["contributors"][number];
export type LegalDocumentDeclaration = PrivacyOptions["documents"][number];
