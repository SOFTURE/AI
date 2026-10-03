// The options an app passes to `billing({ ... })` in softure.config.ts, parsed at startup.
import { LOCALES } from "@softure-ai/core";
import { z } from "zod";
import { PERIOD_UNITS, type PlanPeriod } from "./contract.js";
import { isPaymentProvider, type PaymentProvider } from "./payment.js";
import { isSupportedCurrency } from "./price.js";

/** The longest trial or reminder window, in days. */
export const MAX_DAYS = 365;
/** The most plans the config declares. */
export const MAX_PLANS = 12;
/** The most feature lines one plan lists. */
export const MAX_FEATURES = 20;
/** The highest price, in the currency's minor unit. */
export const MAX_PRICE_AMOUNT = 100_000_000;
/** The most units one period counts. */
export const MAX_PERIOD_COUNT = 1000;

const daysSchema = z.number().int().min(0).max(MAX_DAYS);

/** Kebab-case, at most 64 characters. */
const PLAN_ID_PATTERN = /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/;

/** Copy per locale; a locale without its own text falls back to `en`. */
const localizedTextSchema = z
  .partialRecord(z.enum(LOCALES), z.string().trim().min(1).max(500))
  .refine((text) => text.en !== undefined, "needs at least an en text");

const periodSchema = z.union([
  z.enum([...PERIOD_UNITS, "lifetime"]).transform((unit): PlanPeriod => (unit === "lifetime" ? { unit } : { unit, count: 1 })),
  z.strictObject({ unit: z.enum(PERIOD_UNITS), count: z.number().int().min(1).max(MAX_PERIOD_COUNT).default(1) }),
  z.strictObject({ unit: z.literal("lifetime") }),
]);

const planSchema = z.strictObject({
  /** Kebab-case and unique, e.g. `monthly`; the payment page and the providers name the plan by it. */
  id: z.string().max(64, "must be at most 64 characters").regex(PLAN_ID_PATTERN, "must be kebab-case, e.g. pro-yearly"),
  name: localizedTextSchema,
  description: localizedTextSchema.optional(),
  price: z.strictObject({
    /** In the currency's minor unit: 2900 is 29.00 PLN. */
    amount: z.number().int().min(0).max(MAX_PRICE_AMOUNT),
    currency: z.string().refine((code) => /^[A-Z]{3}$/.test(code) && isSupportedCurrency(code), "must be an upper-case ISO 4217 currency code, e.g. PLN"),
  }),
  /** `"month"`, `"year"`, `"lifetime"`, or `{ unit, count }` such as `{ unit: "month", count: 3 }`. */
  period: periodSchema,
  features: z.array(localizedTextSchema).max(MAX_FEATURES).default([]),
  isFeatured: z.boolean().default(false),
});

export const billingOptionsSchema = z.strictObject({
  trial: z
    .strictObject({
      /** Length of the trial every account starts with, the registration day included; 0 for none. */
      days: daysSchema.default(14),
      /** From how many days left the trial notice shows; 0 never. */
      reminderDays: daysSchema.default(3),
    })
    .prefault({}),
  paid: z
    .strictObject({
      /** From how many days left the renewal notice shows; 0 never. Lifetime access never ends. */
      reminderDays: daysSchema.default(7),
    })
    .prefault({}),
  /** The plans the pricing tiles and the payment page offer, in the order they show them. */
  plans: z
    .array(planSchema)
    .max(MAX_PLANS)
    .default([])
    .superRefine((plans, context) => {
      const seen = new Set<string>();
      plans.forEach((plan, index) => {
        if (seen.has(plan.id)) context.addIssue({ code: "custom", message: `repeats the plan id "${plan.id}"`, path: [index, "id"] });
        seen.add(plan.id);
      });
    }),
  /** The payment adapter, e.g. `manual({ onRequest })`; the payment page needs one. */
  payment: z.custom<PaymentProvider>(isPaymentProvider, "must be a payment provider such as manual()").optional(),
  /** The auth role that may grant plans in the admin page; declared in `auth({ roles })` unless `admin`. */
  adminRole: z.string().min(1).default("admin"),
});

export type BillingOptionsInput = z.input<typeof billingOptionsSchema>;
export type BillingOptions = z.output<typeof billingOptionsSchema>;
