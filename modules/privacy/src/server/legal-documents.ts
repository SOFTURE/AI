// The app's legal documents and their current versions, declared once in `privacy({ documents })`:
// consents are stamped with these versions, and legal pages show the same ones.
import type { SoftureConfig } from "@softure-ai/core";
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
    throw new Error(`@softure-ai/privacy: no legal document "${id}"; declare it in privacy({ documents: [{ id: "${id}", version }] })`);
  }
  return document;
}
