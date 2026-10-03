// The options an app passes to `privacy({ ... })` in softure.config.ts, parsed at startup.
import type { PrivacyContributor } from "@softure-ai/core";
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

const legalDocumentSchema = z.strictObject({
  /** Names the document in consent records and in `getLegalDocument`, e.g. `terms`. */
  id: z.string().max(64, "must be at most 64 characters").regex(CONTRIBUTOR_ID_PATTERN, "must be kebab-case, e.g. privacy-policy"),
  /**
   * The version in force, stamped on every consent given to the document. Change it whenever the
   * published text changes, e.g. to the date the new text takes effect.
   */
  version: z.string().regex(DOCUMENT_VERSION_PATTERN, "must be 1-32 letters, digits, '.', '_' or '-', e.g. 2026-10-01"),
});

export const privacyOptionsSchema = z
  .strictObject({
    /**
     * The app's own contributors, next to the ones of its modules. They export after the modules
     * and delete before them, so app tables that reference module tables go first.
     */
    contributors: z.array(appContributorSchema).default([]),
    /** The app's legal documents (terms, privacy policy) and their current versions. */
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
