// `importDeliveries` on the app's registered configuration and the shared database, e.g. for a one-off route or
// script that seeds the ledger from the app's own history.
import { importDeliveries as importDeliveriesWithContext, type ImportedDelivery, type ImportResult } from "../server/import-deliveries.js";
import { getMailingContext } from "./context.js";

/** Seeds the delivery ledger; see `importDeliveries` in `@softure-ai/mailing/server`. */
export async function importDeliveries(rows: readonly ImportedDelivery[]): Promise<ImportResult> {
  return importDeliveriesWithContext(await getMailingContext(), rows);
}
