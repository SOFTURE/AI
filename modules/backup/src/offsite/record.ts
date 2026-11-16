// The run's row in `backup.runs`, written over a connection: the same SQL deploy.sh pipes into psql on a VPS
// (`buildStatusSql`), sent as one simple query so the insert and the prune share its transaction.
import { withPgClient } from "@softure-ai/deploy";
import { buildStatusSql } from "./status-sql.js";
import type { RunRecord } from "./upload.js";

export async function recordRun(url: string, record: RunRecord): Promise<void> {
  await withPgClient(url, async (client) => {
    await client.query(buildStatusSql(record));
  });
}
