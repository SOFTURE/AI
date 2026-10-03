// `deliverOnce` on the app's registered configuration and the shared database, for server actions
// and route handlers that send a mail at most once (a welcome mail, a lifecycle notice).
import type { Delivery, DeliverOptions, DeliveryOutcome } from "../server/deliveries.js";
import { deliverOnce as deliverOnceWithContext } from "../server/deliveries.js";
import { getMailingContext } from "./context.js";

/** Sends one mail at most once per scope and recipient; see `deliverOnce` in `@softure-ai/mailing/server`. */
export async function deliverOnce(delivery: Delivery, options: DeliverOptions = {}): Promise<DeliveryOutcome> {
  return deliverOnceWithContext(await getMailingContext(), delivery, options);
}
