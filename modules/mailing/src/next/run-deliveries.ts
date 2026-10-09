// `runDeliveries` on the app's registered configuration and the shared database, for a route handler or a job that
// sends lifecycle mail to many recipients at most once each.
import type { DeliveryRunInput, DeliveryRunSummary, RunDeliveriesOptions } from "../server/run-deliveries.js";
import { runDeliveries as runDeliveriesWithContext } from "../server/run-deliveries.js";
import { getMailingContext } from "./context.js";

/** Delivers one mail per recipient through the ledger; see `runDeliveries` in `@softure-ai/mailing/server`. */
export async function runDeliveries<Recipient>(input: DeliveryRunInput<Recipient>, options: RunDeliveriesOptions = {}): Promise<DeliveryRunSummary> {
  return runDeliveriesWithContext(await getMailingContext(), input, options);
}
