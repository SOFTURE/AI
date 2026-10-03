// Pages ready to mount with one line each:
// `export { PaymentPage as default } from "@softure-ai/billing/next"` at `routes.payment`, and
// `export { BillingAdminPage as default } from "@softure-ai/billing/next"` at an admin path.
// Server components: they read the config and the session, and render the forms from `../ui`.
import { requireRole, requireUser } from "@softure-ai/auth/next";
import { formatMessage } from "@softure-ai/core";
import { getSoftureConfig } from "@softure-ai/core/next";
import { ButtonLink, Card, EmptyState } from "@softure-ai/ui";
import { PLAN_FIELD } from "../fields.js";
import { findPlan, getLocalizedText } from "../plans.js";
import { formatPrice } from "../price.js";
import { getBillingMessages, getBillingOptions, getBillingRoutes } from "../server/options.js";
import { getBillingPlans, getPaymentProvider } from "../server/plans.js";
import { formatPeriod } from "../ui/format.js";
import { GrantForm } from "../ui/grant-form.js";
import { PaymentForm } from "../ui/payment-form.js";
import { PricingTiles } from "../ui/pricing-tiles.js";
import { CurrentAccessBadge } from "./access.js";
import { grantPlanAction, startPaymentAction } from "./actions.js";
import { getPlanPaymentHref } from "./pricing.js";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export interface PaymentPageProps {
  readonly searchParams?: SearchParams;
}

const LAYOUT_CLASS = "sft:mx-auto sft:box-border sft:flex sft:w-full sft:flex-col sft:gap-4 sft:sm:max-w-md sft:px-4 sft:py-4";
const STACK_CLASS = "sft:flex sft:flex-col sft:gap-4";
const LEAD_CLASS = "sft:m-0 sft:font-sans sft:text-sm sft:text-muted";

async function readParam(searchParams: SearchParams | undefined, name: string): Promise<string | undefined> {
  const value = (await searchParams)?.[name];
  return Array.isArray(value) ? value[0] : value;
}

/**
 * The plans and, with `?plan=<id>`, the order: the plan's price and the provider's form (the
 * invoice request of the manual adapter, a checkout button of a hosted provider). Without a session
 * it sends the visitor to log in and back. A read-only account reaches it too: it is where to pay.
 */
export async function PaymentPage({ searchParams }: PaymentPageProps) {
  const config = getSoftureConfig();
  const route = getBillingRoutes(config).payment;
  const planId = await readParam(searchParams, PLAN_FIELD);
  const user = await requireUser({ next: planId === undefined ? route : getPlanPaymentHref(route, planId) });
  const provider = getPaymentProvider(config);
  const messages = getBillingMessages(config);
  const copy = messages.payment;
  const plans = getBillingPlans(config);
  const plan = planId === undefined ? undefined : findPlan(plans, planId);
  const planName = plan === undefined ? "" : getLocalizedText(plan.name, config.locale);
  return (
    <main className={LAYOUT_CLASS}>
      <Card title={copy.title} subtitle={copy.lead}>
        <div className={STACK_CLASS}>
          <div>
            <CurrentAccessBadge />
          </div>
          <PricingTiles
            plans={plans}
            messages={messages}
            locale={config.locale}
            getPlanHref={(candidate) => getPlanPaymentHref(route, candidate.id)}
            selectedPlanId={plan?.id}
            label={copy.plansLabel}
          />
        </div>
      </Card>
      {plan === undefined ? null : (
        <Card
          title={copy.orderTitle}
          subtitle={formatMessage(copy.orderLead, { plan: planName, price: formatPrice(plan.price, config.locale), period: formatPeriod(plan.period, config.locale, messages) })}
        >
          <div className={STACK_CLASS}>
            {provider.collectsInvoiceDetails ? <p className={LEAD_CLASS}>{formatMessage(copy.invoiceLead, { email: user.email })}</p> : null}
            <PaymentForm
              action={startPaymentAction}
              planId={plan.id}
              planName={planName}
              email={user.email}
              collectsInvoiceDetails={provider.collectsInvoiceDetails}
              messages={messages}
              locale={config.locale}
            />
            <div>
              <ButtonLink href={route} variant="ghost" size="sm">
                {copy.changePlan}
              </ButtonLink>
            </div>
          </div>
        </Card>
      )}
    </main>
  );
}

/**
 * The admin page that grants plans (the manual adapter's second half). Anyone without the role of
 * `billing({ adminRole })`, signed in or not, gets Next's "not found".
 */
export async function BillingAdminPage() {
  const config = getSoftureConfig();
  await requireRole(getBillingOptions(config).adminRole);
  const messages = getBillingMessages(config);
  const plans = getBillingPlans(config).map((plan) => ({ value: plan.id, label: getLocalizedText(plan.name, config.locale) }));
  return (
    <main className={LAYOUT_CLASS}>
      <Card title={messages.admin.title} subtitle={messages.admin.lead}>
        {plans.length === 0 ? (
          <EmptyState title={messages.admin.noPlans} />
        ) : (
          <GrantForm action={grantPlanAction} plans={plans} messages={messages} locale={config.locale} />
        )}
      </Card>
    </main>
  );
}
