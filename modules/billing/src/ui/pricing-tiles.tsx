// The plans of `billing({ plans })` as tiles: name, price, period, description, feature lines and a
// button to choose the plan. Server-safe and framework-free: it renders from props, and the button
// goes through an injected `LinkComponent` (`Pricing` and `PaymentPage` in `/next` wire it).
import { formatMessage, type Locale } from "@softure-ai/core";
import { ButtonLink, CheckIcon, type ClassNames, createSlotClassGetter, EmptyState, type LinkComponentType } from "@softure-ai/ui";
import type { Plan } from "../contract.js";
import type { BillingMessages } from "../messages/index.js";
import { getLocalizedText } from "../plans.js";
import { formatPrice } from "../price.js";
import { formatPeriod } from "./format.js";

export type PricingTilesSlot = "root" | "tile" | "badge" | "name" | "description" | "priceRow" | "price" | "period" | "features" | "feature" | "featureIcon" | "action";

export interface PricingTilesProps {
  readonly plans: readonly Plan[];
  readonly messages: BillingMessages;
  readonly locale: Locale;
  /** Where a tile's button leads, e.g. the payment page with the plan; no button when omitted. */
  readonly getPlanHref?: (plan: Plan) => string;
  /** The plan already chosen: its tile is marked `aria-current` and has no button. */
  readonly selectedPlanId?: string;
  /** Renders the buttons; a plain `<a>` when omitted. */
  readonly LinkComponent?: LinkComponentType;
  /** Names the list of plans for assistive technology. */
  readonly label?: string;
  readonly classNames?: ClassNames<PricingTilesSlot>;
  readonly unstyled?: boolean;
}

const TILE_CLASS = "sft:flex sft:flex-col sft:gap-3 sft:rounded-card sft:border sft:bg-surface sft:p-5 sft:font-sans";

const DEFAULT_CLASSES: Readonly<Record<PricingTilesSlot, string>> = {
  root: "sft:m-0 sft:flex sft:list-none sft:flex-col sft:gap-4 sft:p-0",
  tile: `${TILE_CLASS} sft:border-border`,
  badge: "sft:m-0 sft:w-fit sft:rounded-full sft:bg-accent-fill sft:px-2.5 sft:py-1 sft:text-xs sft:font-medium sft:text-on-accent",
  name: "sft:m-0 sft:font-heading sft:text-lg sft:font-semibold sft:text-foreground",
  description: "sft:m-0 sft:text-sm sft:text-muted",
  priceRow: "sft:m-0 sft:flex sft:items-baseline sft:gap-2",
  price: "sft:text-2xl sft:font-bold sft:tabular-nums sft:text-foreground",
  period: "sft:text-sm sft:text-muted",
  features: "sft:m-0 sft:flex sft:list-none sft:flex-col sft:gap-1.5 sft:p-0 sft:text-sm sft:text-foreground",
  feature: "sft:flex sft:items-start sft:gap-2",
  featureIcon: "sft:mt-0.5 sft:size-4 sft:shrink-0 sft:text-success",
  action: "sft:flex",
};

/** A featured or chosen tile stands out with a stronger border and a shadow. */
const PROMINENT_CLASSES: Readonly<Record<PricingTilesSlot, string>> = { ...DEFAULT_CLASSES, tile: `${TILE_CLASS} sft:border-border-strong sft:shadow-2` };

export function PricingTiles({ plans, messages, locale, getPlanHref, selectedPlanId, LinkComponent, label, classNames, unstyled }: PricingTilesProps) {
  if (plans.length === 0) return <EmptyState title={messages.pricing.empty} unstyled={unstyled} />;
  const regular = createSlotClassGetter({ defaults: DEFAULT_CLASSES, classNames, unstyled });
  const prominent = createSlotClassGetter({ defaults: PROMINENT_CLASSES, classNames, unstyled });
  return (
    <ul className={regular("root")} aria-label={label}>
      {plans.map((plan) => {
        const name = getLocalizedText(plan.name, locale);
        const isSelected = plan.id === selectedPlanId;
        const href = isSelected ? undefined : getPlanHref?.(plan);
        const slot = plan.isFeatured || isSelected ? prominent : regular;
        return (
          <li
            key={plan.id}
            className={slot("tile")}
            data-plan={plan.id}
            data-featured={plan.isFeatured ? "true" : undefined}
            aria-current={isSelected ? "true" : undefined}
          >
            {plan.isFeatured ? <p className={slot("badge")}>{messages.pricing.featured}</p> : null}
            <h3 className={slot("name")}>{name}</h3>
            <p className={slot("priceRow")}>
              <span className={slot("price")}>{formatPrice(plan.price, locale)}</span>
              <span className={slot("period")}>{formatPeriod(plan.period, locale, messages)}</span>
            </p>
            {plan.description === undefined ? null : <p className={slot("description")}>{getLocalizedText(plan.description, locale)}</p>}
            {plan.features.length === 0 ? null : (
              <ul className={slot("features")}>
                {plan.features.map((feature, index) => (
                  // Feature lines have no id; their order in the config is stable.
                  <li key={index} className={slot("feature")}>
                    <CheckIcon className={slot("featureIcon")} />
                    <span>{getLocalizedText(feature, locale)}</span>
                  </li>
                ))}
              </ul>
            )}
            {href === undefined ? null : (
              <div className={slot("action")}>
                <ButtonLink
                  href={href}
                  LinkComponent={LinkComponent}
                  variant={plan.isFeatured ? "primary" : "secondary"}
                  fullWidth
                  unstyled={unstyled}
                >
                  {formatMessage(messages.pricing.choose, { plan: name })}
                </ButtonLink>
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}
