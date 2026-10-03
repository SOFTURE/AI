// What payments need from the app's other modules, checked once per config before the first
// payment: the rate limit bucket in `security({ buckets })`. A setup mistake then fails with one
// clear error instead of on each request.
import { getModule, type SoftureConfig } from "@softure-ai/core";

export const PAYMENT_BUCKET = "billing-payment";

const checkedConfigs = new WeakSet<SoftureConfig>();

export function assertPaymentSetup(config: SoftureConfig): void {
  if (checkedConfigs.has(config)) return;
  const security = getModule(config, "security")?.options as { buckets?: Readonly<Record<string, unknown>> } | undefined;
  if (!Object.hasOwn(security?.buckets ?? {}, PAYMENT_BUCKET)) {
    throw new Error(`@softure-ai/billing: security({ buckets }) lacks "${PAYMENT_BUCKET}"; spread BILLING_RATE_LIMIT_BUCKETS into it`);
  }
  checkedConfigs.add(config);
}
