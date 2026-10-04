// What billing needs from the app's other modules, checked once per config so a setup mistake fails
// with one clear error instead of on each request: the rate limit bucket in `security({ buckets })`
// (before the first payment), and an `adminRole` that `auth({ roles })` declares (at the first
// billing request and in the readiness probe).
import { getDeclaredRoles, isDeclaredRole } from "@softure-ai/auth/server";
import { getModule, type SoftureConfig } from "@softure-ai/core";
import { getBillingOptions } from "./options.js";

export const PAYMENT_BUCKET = "billing-payment";

const checkedPaymentConfigs = new WeakSet<SoftureConfig>();
const checkedRoleConfigs = new WeakSet<SoftureConfig>();

export function assertPaymentSetup(config: SoftureConfig): void {
  if (checkedPaymentConfigs.has(config)) return;
  const security = getModule(config, "security")?.options as { buckets?: Readonly<Record<string, unknown>> } | undefined;
  if (!Object.hasOwn(security?.buckets ?? {}, PAYMENT_BUCKET)) {
    throw new Error(`@softure-ai/billing: security({ buckets }) lacks "${PAYMENT_BUCKET}"; spread BILLING_RATE_LIMIT_BUCKETS into it`);
  }
  checkedPaymentConfigs.add(config);
}

/**
 * Throws when `billing({ adminRole })` is not a role of `auth({ roles })`: a misspelt role would
 * otherwise surface only when an admin opens the admin page.
 */
export function assertAdminRoleDeclared(config: SoftureConfig): void {
  if (checkedRoleConfigs.has(config)) return;
  const { adminRole } = getBillingOptions(config);
  if (!isDeclaredRole(config, adminRole)) {
    const declared = [...getDeclaredRoles(config)].join(", ");
    throw new Error(
      `@softure-ai/billing: billing({ adminRole }) is "${adminRole}", which auth({ roles }) does not declare (declared: ${declared}); declare it there or fix the name`,
    );
  }
  checkedRoleConfigs.add(config);
}
