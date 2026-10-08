// Pages ready to mount with one line each:
// `export { PaymentPage as default } from "@softure-ai/billing/next"` at `routes.payment`, and
// `export { BillingAdminPage as default } from "@softure-ai/billing/next"` at `routes.admin`.
// Server components: they read the config and the session, and render the forms from `../ui`.
import { requireRole, requireUser } from "@softure-ai/auth/next";
import { formatMessage, type Locale, type SoftureConfig } from "@softure-ai/core";
import { getSoftureConfig } from "@softure-ai/core/next";
import { ButtonLink, Card, EmptyState } from "@softure-ai/ui";
import type { PaymentGrant, Plan } from "../contract.js";
import { ACCOUNT_PARAM, CHECKOUT_PARAM, CHECKOUT_RESULTS, PLAN_FIELD, type CheckoutResult } from "../fields.js";
import type { BillingMessages } from "../messages/index.js";
import { findPlan, getLocalizedText } from "../plans.js";
import { formatPrice } from "../price.js";
import { getEntitlement } from "../server/entitlements.js";
import { getAccountHistory, type AccountHistoryEntry } from "../server/grants.js";
import { getBillingMessages, getBillingOptions, getBillingRoutes } from "../server/options.js";
import { findAccountById, getBillingPlans, getPaymentProvider } from "../server/plans.js";
import { listOpenRequests, type OpenPaymentRequest } from "../server/requests.js";
import { AccessBadge } from "../ui/access-badge.js";
import { formatDay, formatLastDay, formatPeriod } from "../ui/format.js";
import { GrantForm } from "../ui/grant-form.js";
import { AccountLookup, GrantHistory, type GrantHistoryRow } from "../ui/grant-history.js";
import { PaymentForm } from "../ui/payment-form.js";
import { PaymentRequestList, type PaymentRequestRow } from "../ui/payment-requests.js";
import { PricingTiles } from "../ui/pricing-tiles.js";
import { TrialForm } from "../ui/trial-form.js";
import { CurrentAccessBadge } from "./access.js";
import { dismissRequestAction, extendTrialAction, findAccountAction, grantPlanAction, grantRequestAction, revokeGrantAction, startPaymentAction } from "./actions.js";
import { getBillingContext } from "./context.js";
import { getCurrentEntitlement } from "./current-entitlement.js";
import { getPlanPaymentHref } from "./pricing.js";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export interface PaymentPageProps {
  readonly searchParams?: SearchParams;
  /**
   * The page's `<h1>`, first in `<main>`: `payment.heading` of the messages by default, this text
   * instead, or none with `null` (for an app whose frame renders the page heading).
   */
  readonly heading?: string | null;
  /** One paragraph right after the `<h1>` (first in `<main>` without one) that says what the page is for; none by default. */
  readonly lead?: string | null;
}

const LAYOUT_CLASS = "sft:mx-auto sft:box-border sft:flex sft:w-full sft:flex-col sft:gap-4 sft:sm:max-w-md sft:px-4 sft:py-4";
const STACK_CLASS = "sft:flex sft:flex-col sft:gap-4";
const HEADING_CLASS = "sft:m-0 sft:font-heading sft:text-2xl sft:font-bold sft:text-foreground";
const LEAD_CLASS = "sft:m-0 sft:font-sans sft:text-sm sft:text-muted";
const NOTICE_CLASS =
  "sft:m-0 sft:rounded-control sft:border sft:border-border-strong sft:bg-surface-raised sft:px-4 sft:py-2.5 sft:font-sans sft:text-sm sft:text-foreground";

async function readParam(searchParams: SearchParams | undefined, name: string): Promise<string | undefined> {
  const value = (await searchParams)?.[name];
  return Array.isArray(value) ? value[0] : value;
}

function isCheckoutResult(value: string | undefined): value is CheckoutResult {
  return CHECKOUT_RESULTS.some((result) => result === value);
}

/**
 * The plans and, with `?plan=<id>`, the order: the plan's price and the provider's form (the
 * invoice request of the manual adapter, a checkout button of a hosted provider). Without a session
 * it sends the visitor to log in and back. A read-only account reaches it too: it is where to pay.
 * A hosted checkout comes back with `?checkout=success` or `?checkout=cancelled`, shown as a notice
 * (the access itself changes when the provider's webhook confirms the payment).
 */
export async function PaymentPage({ searchParams, heading, lead }: PaymentPageProps) {
  const config = getSoftureConfig();
  const route = getBillingRoutes(config).payment;
  const planId = await readParam(searchParams, PLAN_FIELD);
  const checkout = await readParam(searchParams, CHECKOUT_PARAM);
  const user = await requireUser({ next: planId === undefined ? route : getPlanPaymentHref(route, planId), searchParams: await searchParams });
  const provider = getPaymentProvider(config);
  const messages = getBillingMessages(config);
  const copy = messages.payment;
  const plans = getBillingPlans(config);
  const plan = planId === undefined ? undefined : findPlan(plans, planId);
  const planName = plan === undefined ? "" : getLocalizedText(plan.name, config.locale);
  const checkoutNotice = isCheckoutResult(checkout) ? (checkout === "success" ? copy.checkoutSuccess : copy.checkoutCancelled) : null;
  const entitlement = await getCurrentEntitlement();
  // Lifetime access leaves nothing to pay for: no order form (startPayment refuses it too).
  const hasLifetime = entitlement?.status === "paid" && entitlement.endsAt === null;
  return (
    <main className={LAYOUT_CLASS}>
      <PageHeading text={heading === undefined ? copy.heading : heading} lead={lead ?? null} />
      <Card title={copy.title} subtitle={copy.lead}>
        <div className={STACK_CLASS}>
          {checkoutNotice === null ? null : (
            <p role="status" className={NOTICE_CLASS} data-checkout={checkout}>
              {checkoutNotice}
            </p>
          )}
          <div>
            <CurrentAccessBadge />
          </div>
          {hasLifetime ? (
            <p role="status" className={NOTICE_CLASS} data-lifetime="true">
              {copy.lifetime}
            </p>
          ) : null}
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
      {plan === undefined || hasLifetime ? null : (
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

/** The page's `<h1>` and its lead paragraph, each left out for `null`. */
function PageHeading({ text, lead }: { readonly text: string | null; readonly lead: string | null }) {
  return (
    <>
      {text === null ? null : <h1 className={HEADING_CLASS}>{text}</h1>}
      {lead === null ? null : <p className={LEAD_CLASS}>{lead}</p>}
    </>
  );
}

/** The plan's name in the app's locale, or its id when the config no longer has it. */
function getPlanName(plans: readonly Plan[], planId: string, locale: Locale): string {
  const plan = findPlan(plans, planId);
  return plan === undefined ? planId : getLocalizedText(plan.name, locale);
}

interface RowContext {
  readonly config: SoftureConfig;
  readonly messages: BillingMessages;
  readonly plans: readonly Plan[];
  /** The page's instant, to tell a trial extension still running from an ended one. */
  readonly now: Date;
}

function getHistoryHref(config: SoftureConfig, userId: string): string {
  return `${getBillingRoutes(config).admin}?${new URLSearchParams({ [ACCOUNT_PARAM]: userId }).toString()}`;
}

function toRequestRow(request: OpenPaymentRequest, { config, messages, plans }: RowContext): PaymentRequestRow {
  const copy = messages.admin.requests;
  const values = { email: request.email, plan: getPlanName(plans, request.planId, config.locale) };
  const { invoice } = request;
  const details = [formatMessage(copy.requestedOn, { date: formatDay(request.requestedAt, config.locale, config.timezone) })];
  if (request.price !== null) details.push(formatMessage(copy.price, { price: formatPrice(request.price, config.locale) }));
  if (invoice === null) details.push(copy.noInvoice);
  else {
    details.push(formatMessage(copy.invoice, { name: invoice.name, address: invoice.address }));
    if (invoice.taxId !== null) details.push(formatMessage(copy.taxId, { taxId: invoice.taxId }));
  }
  return {
    id: request.id,
    title: formatMessage(copy.line, values),
    details,
    historyHref: getHistoryHref(config, request.userId),
    grantLabel: formatMessage(copy.grantLabel, values),
    dismissLabel: formatMessage(copy.dismissLabel, values),
  };
}

function describeGrant(grant: PaymentGrant | null, { config, messages }: RowContext): string {
  const copy = messages.admin.history;
  if (grant === null) return copy.noGrant;
  if (grant.kind === "lifetime") return copy.lifetime;
  return formatMessage(copy.period, { from: formatDay(grant.from, config.locale, config.timezone), to: formatLastDay(grant.until, config.locale, config.timezone) });
}

function toHistoryRow(entry: AccountHistoryEntry, context: RowContext): GrantHistoryRow {
  const { config, messages, plans } = context;
  const copy = messages.admin.history;
  const formatDate = (date: Date) => formatDay(date, config.locale, config.timezone);
  if (entry.source === "trial") {
    const formatEnd = (end: Date) => formatLastDay(end, config.locale, config.timezone);
    return {
      id: entry.id,
      title: copy.trialExtended,
      statusText: formatMessage(copy.trialUntil, { date: formatEnd(entry.endsAt) }),
      isCurrent: entry.endsAt > context.now,
      details: [formatMessage(copy.extendedOn, { date: formatDate(entry.at) }), formatMessage(copy.trialWasUntil, { date: formatEnd(entry.previousEndsAt) })],
      revokeLabel: null,
    };
  }
  const plan = getPlanName(plans, entry.planId, config.locale);
  if (entry.source === "manual") {
    const isActive = entry.status === "active";
    return {
      id: entry.id,
      title: formatMessage(entry.isFromRequest ? copy.fromRequest : copy.manual, { plan }),
      statusText: isActive || entry.revokedAt === null ? copy.active : formatMessage(copy.revokedOn, { date: formatDate(entry.revokedAt) }),
      isCurrent: isActive,
      details: [
        entry.price === null
          ? formatMessage(copy.grantedOn, { date: formatDate(entry.at) })
          : formatMessage(copy.grantedFor, { amount: formatPrice(entry.price, config.locale), date: formatDate(entry.at) }),
        describeGrant(entry.grant, context),
      ],
      revokeLabel: isActive ? formatMessage(copy.revokeLabel, { plan, date: formatDate(entry.at) }) : null,
    };
  }
  const isPaid = entry.status === "paid";
  const formatAmount = (amount: number) => formatPrice({ amount, currency: entry.currency }, config.locale);
  let statusText = copy.paid;
  if (!isPaid && entry.refundedAt !== null) statusText = formatMessage(copy.refundedOn, { date: formatDate(entry.refundedAt) });
  else if (entry.refundedAmount > 0) statusText = formatMessage(copy.partlyRefunded, { amount: formatAmount(entry.refundedAmount) });
  return {
    id: entry.id,
    title: formatMessage(copy.provider, { plan, provider: entry.provider }),
    statusText,
    isCurrent: isPaid,
    details: [
      formatMessage(copy.paidOn, { amount: formatAmount(entry.amount), date: formatDate(entry.at) }),
      describeGrant(entry.grant, context),
    ],
    revokeLabel: null,
  };
}

export interface BillingAdminPageProps {
  readonly searchParams?: SearchParams;
  /**
   * The page's `<h1>`, first in `<main>`: `admin.heading` of the messages by default, this text
   * instead, or none with `null` (for an app whose frame renders the page heading).
   */
  readonly heading?: string | null;
  /** One paragraph right after the `<h1>` (first in `<main>` without one) that says what the page is for; none by default. */
  readonly lead?: string | null;
}

/**
 * The admin page of manual payments: the open invoice requests (grant or dismiss each), the grant
 * form, the trial form (a free, longer trial), and an account's history (`?account=<id>`, reached by the email lookup or a request's
 * link) with its access and a revoke button on each active manual grant. Anyone without the role
 * of `billing({ adminRole })`, signed in or not, gets Next's "not found".
 */
export async function BillingAdminPage({ searchParams, heading, lead }: BillingAdminPageProps) {
  const config = getSoftureConfig();
  await requireRole(getBillingOptions(config).adminRole);
  const messages = getBillingMessages(config);
  const plans = getBillingPlans(config);
  const ctx = await getBillingContext(config);
  const context: RowContext = { config, messages, plans, now: ctx.clock.now() };
  const requests = (await listOpenRequests(ctx)).map((request) => toRequestRow(request, context));
  const accountId = await readParam(searchParams, ACCOUNT_PARAM);
  const account = accountId === undefined ? null : await findAccountById(ctx, accountId);
  const entitlement = account === null ? null : await getEntitlement(ctx, account.id);
  const history = account === null ? [] : (await getAccountHistory(ctx, account.id)).map((entry) => toHistoryRow(entry, context));
  const planOptions = plans.map((plan) => ({ value: plan.id, label: getLocalizedText(plan.name, config.locale) }));
  return (
    <main className={LAYOUT_CLASS}>
      <PageHeading text={heading === undefined ? messages.admin.heading : heading} lead={lead ?? null} />
      <Card title={messages.admin.requests.title} subtitle={messages.admin.requests.lead}>
        <PaymentRequestList requests={requests} grantAction={grantRequestAction} dismissAction={dismissRequestAction} messages={messages} />
      </Card>
      <Card title={messages.admin.title} subtitle={messages.admin.lead}>
        {planOptions.length === 0 ? (
          <EmptyState title={messages.admin.noPlans} />
        ) : (
          <GrantForm action={grantPlanAction} plans={planOptions} messages={messages} locale={config.locale} />
        )}
      </Card>
      <Card title={messages.admin.trial.title} subtitle={messages.admin.trial.lead}>
        <TrialForm action={extendTrialAction} messages={messages} locale={config.locale} />
      </Card>
      <Card title={messages.admin.history.title} subtitle={messages.admin.history.lead}>
        <div className={STACK_CLASS}>
          <AccountLookup action={findAccountAction} messages={messages} locale={config.locale} />
          {account === null ? null : (
            <section className={STACK_CLASS} aria-label={formatMessage(messages.admin.history.accountTitle, { email: account.email })}>
              <p className={LEAD_CLASS}>{formatMessage(messages.admin.history.accountTitle, { email: account.email })}</p>
              {entitlement === null ? null : (
                <div>
                  <AccessBadge entitlement={entitlement} messages={messages} locale={config.locale} timezone={config.timezone} />
                </div>
              )}
              <GrantHistory rows={history} revokeAction={revokeGrantAction} messages={messages} />
            </section>
          )}
        </div>
      </Card>
    </main>
  );
}
