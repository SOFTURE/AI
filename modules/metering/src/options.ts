// The options an app passes to `metering({ ... })` in softure.config.ts, parsed at startup.
import { z } from "zod";
import { METERING_UNITS } from "./contract.js";

/** A provider id as the ledger stores it: lower case, words joined by `.`, `_` or `-` (e.g. `elevenlabs`, `open-router`). */
export const PROVIDER_ID_PATTERN = /^[a-z][a-z0-9]*(?:[._-][a-z0-9]+)*$/;
export const MAX_PROVIDER_ID_LENGTH = 64;

const budgetSchema = z.strictObject({
  period: z.enum(["day", "month"]),
  /** The most the period may spend, in the provider's unit. */
  limit: z.number().finite().positive(),
  /** `true`: each account has this limit on its own; `false`: every call of the provider shares it. */
  perAccount: z.boolean().default(false),
});

const providerSchema = z.strictObject({
  id: z
    .string()
    .max(MAX_PROVIDER_ID_LENGTH, `must be at most ${String(MAX_PROVIDER_ID_LENGTH)} characters`)
    .regex(PROVIDER_ID_PATTERN, "must be lower case words joined by . _ or -, e.g. elevenlabs"),
  /** What the provider bills in; every amount of this provider is in it. */
  unit: z.enum(METERING_UNITS),
  budgets: z.array(budgetSchema).default([]),
});

export const meteringOptionsSchema = z
  .strictObject({
    /** Every provider the app meters. Spend of a provider not listed here is refused as a bug. */
    providers: z.array(providerSchema).default([]),
    /** How long a reservation holds budget when it is neither settled nor released (a crashed call). */
    reservationTtlSeconds: z.number().int().min(1).max(7 * 24 * 60 * 60).default(60 * 60),
  })
  .superRefine((options, context) => {
    const ids = new Set<string>();
    options.providers.forEach((provider, index) => {
      if (ids.has(provider.id)) {
        context.addIssue({ code: "custom", path: ["providers", index, "id"], message: `"${provider.id}" is declared twice` });
      }
      ids.add(provider.id);
      const scopes = new Set<string>();
      provider.budgets.forEach((budget, budgetIndex) => {
        const key = `${budget.period}:${String(budget.perAccount)}`;
        if (scopes.has(key)) {
          context.addIssue({
            code: "custom",
            path: ["providers", index, "budgets", budgetIndex],
            message: `a ${budget.period} budget ${budget.perAccount ? "per account" : "for the whole provider"} is declared twice`,
          });
        }
        scopes.add(key);
      });
    });
  });

export type MeteringOptionsInput = z.input<typeof meteringOptionsSchema>;
export type MeteringOptions = z.output<typeof meteringOptionsSchema>;
export type ProviderDefinitionInput = z.input<typeof providerSchema>;
export type ProviderDefinition = z.output<typeof providerSchema>;
export type BudgetDefinition = z.output<typeof budgetSchema>;
