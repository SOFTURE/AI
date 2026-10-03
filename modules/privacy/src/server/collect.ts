// The export: every contributor's part of one user's data, read in one transaction so the parts
// agree with each other, and bounded in size before it is handed to a response.
import { err, ok, type Err, type Ok } from "@softure-ai/core";
import type { PrivacyExport } from "../contract.js";
import type { PrivacyContext } from "./context.js";
import { getExportingContributors } from "./contributors.js";
import { getPrivacyOptions } from "./options.js";

export interface CollectedUserData {
  readonly document: PrivacyExport;
  /** The document as JSON, the bytes a download sends; measured against `export.maxBytes`. */
  readonly json: string;
}

export type CollectUserDataResult = Ok<CollectedUserData> | Err<"privacy.export_failed" | "privacy.export_too_large">;

/**
 * Collects every exporting contributor's part for `userId`. A contributor's `Err` fails the whole
 * export (`privacy.export_failed`, logged with the contributor's id and code): a file with a part
 * missing would look complete. Thrown errors (a database failure) propagate after the rollback.
 */
export async function collectUserData(ctx: PrivacyContext, userId: string): Promise<CollectUserDataResult> {
  const contributors = getExportingContributors(ctx.config);
  const exportedAt = ctx.clock.now();

  const collected = await ctx.db.transaction(
    async (tx): Promise<Ok<Record<string, unknown>> | Err<"privacy.export_failed">> => {
      const txCtx: PrivacyContext = { ...ctx, db: tx };
      const data: Record<string, unknown> = {};
      for (const contributor of contributors) {
        const part = await contributor.exportUserData(txCtx, userId);
        if (!part.ok) {
          console.error(`@softure-ai/privacy: contributor "${contributor.id}" failed the export: ${part.error}`);
          return err("privacy.export_failed");
        }
        data[contributor.id] = part.value;
      }
      return ok(data);
    },
    { isolationLevel: "repeatable read", accessMode: "read only" },
  );
  if (!collected.ok) return collected;

  const document: PrivacyExport = {
    format: "softure.privacy-export",
    version: 1,
    userId,
    exportedAt: exportedAt.toISOString(),
    data: collected.value,
  };
  const json = JSON.stringify(document, null, 2);
  const { maxBytes } = getPrivacyOptions(ctx.config).export;
  if (Buffer.byteLength(json, "utf8") > maxBytes) {
    console.error(`@softure-ai/privacy: an export exceeded export.maxBytes (${String(maxBytes)})`);
    return err("privacy.export_too_large");
  }
  return ok({ document, json });
}
