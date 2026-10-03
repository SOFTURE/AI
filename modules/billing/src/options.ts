// The options an app passes to `billing({ ... })` in softure.config.ts, parsed at startup.
import { z } from "zod";

/** The longest trial or reminder window, in days. */
export const MAX_DAYS = 365;

const daysSchema = z.number().int().min(0).max(MAX_DAYS);

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
});

export type BillingOptionsInput = z.input<typeof billingOptionsSchema>;
export type BillingOptions = z.output<typeof billingOptionsSchema>;
