// The options an app passes to `waitlist({ ... })` in softure.config.ts, parsed at startup.
import { LOCALES } from "@softure-ai/core";
import { z } from "zod";

/** Kebab-case, at most 64 characters: scope ids are consent purposes in privacy's ledger. */
export const NAME_PATTERN = /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/;
export const MAX_NAME_LENGTH = 64;
/** The most scopes a waitlist offers (the table holds at most this many per sign-up). */
export const MAX_SCOPES = 16;

const nameSchema = z.string().max(MAX_NAME_LENGTH, `must be at most ${String(MAX_NAME_LENGTH)} characters`).regex(NAME_PATTERN, "must be kebab-case, e.g. launch-news");

/** Copy per locale; a locale without its own text falls back to `en`. */
const localizedTextSchema = z
  .partialRecord(z.enum(LOCALES), z.string().trim().min(1).max(500))
  .refine((text) => text.en !== undefined, "needs at least an en text");

const scopeSchema = z.strictObject({
  /** What the person agrees to, e.g. `launch` or `newsletter`; recorded as the consent purpose. */
  id: nameSchema,
  /** The form cannot be sent without it (the consent the waitlist exists for). */
  required: z.boolean().default(false),
  /** A legal document declared in `privacy({ documents })`; its version is recorded with the consent. */
  document: nameSchema.optional(),
  /** The checkbox statement. `consentLabels` of the form can replace it with markup (links). */
  label: localizedTextSchema,
});

export const waitlistOptionsSchema = z
  .strictObject({
    /** The consent scopes the form offers, in the order it shows them. */
    scopes: z.array(scopeSchema).min(1, "needs at least one scope").max(MAX_SCOPES, `takes at most ${String(MAX_SCOPES)} scopes`),
    /** Where the app embeds the form, e.g. `hero` and `footer`; each sign-up stores its first one. */
    placements: z.array(nameSchema).min(1, "needs at least one placement").default(["default"]),
    /** Sends the welcome mail after a first sign-up. Off, the app sends its own (or none). */
    welcomeMail: z.boolean().default(true),
  })
  .superRefine((options, context) => {
    const findDuplicates = (values: readonly string[], toPath: (index: number) => (string | number)[]) => {
      const seen = new Set<string>();
      values.forEach((value, index) => {
        if (seen.has(value)) context.addIssue({ code: "custom", path: toPath(index), message: `"${value}" is listed twice` });
        seen.add(value);
      });
    };
    findDuplicates(
      options.scopes.map((scope) => scope.id),
      (index) => ["scopes", index, "id"],
    );
    findDuplicates(options.placements, (index) => ["placements", index]);
  });

export type WaitlistOptionsInput = z.input<typeof waitlistOptionsSchema>;
export type WaitlistOptions = z.output<typeof waitlistOptionsSchema>;
export type WaitlistScopeInput = z.input<typeof scopeSchema>;
export type WaitlistScope = z.output<typeof scopeSchema>;
