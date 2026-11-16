// Plain helpers of the document parts, kept outside the client module so Server Components can use them.

/** How a document is shown: a PDF's pages, an image, or neither. */
export type DocumentKind = "pdf" | "image" | "other";

/** The kind of a document by its media type (`application/pdf`, `image/png`; parameters ignored). */
export function getDocumentKind(contentType: string): DocumentKind {
  const essence = (contentType.split(";")[0] ?? "").trim().toLowerCase();
  if (essence === "application/pdf") return "pdf";
  if (essence.startsWith("image/")) return "image";
  return "other";
}

/** The zoom steps, as a share of the fitted width. */
export const DOCUMENT_ZOOM_STEPS: readonly number[] = [0.5, 0.75, 1, 1.25, 1.5, 2, 3];
