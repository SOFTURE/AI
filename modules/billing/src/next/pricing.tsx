// The pricing tiles wired to the registered config, for any server component (a landing or a
// pricing page): `<Pricing LinkComponent={Link} />`. Each tile's button opens the payment page with
// its plan; the page asks a visitor without a session to log in first.
import { getSoftureConfig } from "@softure-ai/core/next";
import type { ClassNames, LinkComponentType } from "@softure-ai/ui";
import { PLAN_FIELD } from "../fields.js";
import { getBillingMessages, getBillingRoutes } from "../server/options.js";
import { getBillingPlans } from "../server/plans.js";
import { PricingTiles, type PricingTilesSlot } from "../ui/pricing-tiles.js";

export interface PricingProps {
  /** The app's link component, e.g. Next's `Link`; a plain `<a>` when omitted. */
  readonly LinkComponent?: LinkComponentType;
  readonly classNames?: ClassNames<PricingTilesSlot>;
  readonly unstyled?: boolean;
}

/** The payment page with a plan chosen. */
export function getPlanPaymentHref(paymentRoute: string, planId: string): string {
  return `${paymentRoute}?${PLAN_FIELD}=${encodeURIComponent(planId)}`;
}

export function Pricing({ LinkComponent, classNames, unstyled }: PricingProps) {
  const config = getSoftureConfig();
  const messages = getBillingMessages(config);
  const payment = getBillingRoutes(config).payment;
  return (
    <PricingTiles
      plans={getBillingPlans(config)}
      messages={messages}
      locale={config.locale}
      getPlanHref={(plan) => getPlanPaymentHref(payment, plan.id)}
      LinkComponent={LinkComponent}
      label={messages.payment.plansLabel}
      classNames={classNames}
      unstyled={unstyled}
    />
  );
}
