// The app's legal documents and their current versions, declared once in `privacy({ documents })`:
// consents are stamped with these versions, and legal pages show the same ones.
import { isCalendarDay, toCalendarDay, type SoftureConfig } from "@softure-ai/core";
import type { LegalDocumentDeclaration } from "../options.js";
import { getPrivacyOptions } from "./options.js";

/** Every declared document, in the order the config lists them. */
export function getLegalDocuments(config: SoftureConfig): readonly LegalDocumentDeclaration[] {
  return getPrivacyOptions(config).documents;
}

/** The declared document with this id, or undefined. */
export function findLegalDocument(config: SoftureConfig, id: string): LegalDocumentDeclaration | undefined {
  return getLegalDocuments(config).find((document) => document.id === id);
}

/** The declared document with this id. Throws for an id the config does not declare: a page naming one is a bug. */
export function getLegalDocument(config: SoftureConfig, id: string): LegalDocumentDeclaration {
  const document = findLegalDocument(config, id);
  if (document === undefined) {
    throw new Error(`@softure-ai/privacy: no legal document "${id}"; declare it in privacy({ documents: [{ id: "${id}", version }] }) or with its history`);
  }
  return document;
}

/**
 * The version of the document in force on a calendar day (`YYYY-MM-DD`) or at an instant, read as
 * the day in the config's time zone: the newest history entry dated on or before that day. Undefined
 * before the first entry. A document declared without history has one known version, which it
 * answers for any day. Throws for an undeclared id or a string that is not a calendar day.
 */
export function getDocumentVersionAt(config: SoftureConfig, id: string, at: Date | string): string | undefined {
  const document = getLegalDocument(config, id);
  const day = at instanceof Date ? toCalendarDay(at, config.timezone) : at;
  if (!isCalendarDay(day)) {
    throw new Error(`@softure-ai/privacy: getDocumentVersionAt: ${JSON.stringify(at)} is not a calendar day, YYYY-MM-DD`);
  }
  if (document.history.length === 0) return document.version;
  return document.history.find((revision) => revision.date <= day)?.version;
}
