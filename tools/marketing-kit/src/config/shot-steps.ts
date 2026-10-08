import { z } from "zod";

import { locatorSchema } from "./actions-schema.js";

/**
 * What a screenshot does on the page before it is judged: the sign-in form (`signIn.steps`) and an entry's own
 * `steps` (open a collapsed section). Plain Playwright calls on a locator, with no camera and no timing: a screenshot
 * records nothing in between. `crop` frames one element at a fixed aspect ratio instead of the viewport.
 */

/** A Playwright key name, modifiers joined with `+`; Playwright itself refuses a name it does not know. */
const KEY_PATTERN = /^\S+$/;
/** `W:H` with whole numbers from 1 to 9999, e.g. `4:3`. */
export const ASPECT_PATTERN = /^[1-9]\d{0,3}:[1-9]\d{0,3}$/;

const target = locatorSchema.describe("The element, as a locator descriptor with exactly one of role, text, label, testId, css.");

export const shotStepSchema = z.discriminatedUnion("do", [
  z.strictObject({
    do: z.literal("fill").describe("Replaces the value of an input, e.g. the e-mail of the sign-in form."),
    target,
    value: z.string().describe("The value; {env:NAME} and {data:key} are replaced. Never printed, so a password may go here as {env:NAME}."),
  }),
  z.strictObject({
    do: z.literal("click").describe("Clicks the element, e.g. the submit button or a collapsed section's summary."),
    target,
  }),
  z.strictObject({
    do: z.literal("check").describe("Ticks a checkbox or radio button, e.g. the terms of a sign-up form."),
    target,
  }),
  z.strictObject({
    do: z.literal("press").describe("Presses a key on the focused element, e.g. Enter."),
    key: z.string().regex(KEY_PATTERN, "must be a key name such as Enter or Escape").describe("A Playwright key name; modifiers joined with +."),
  }),
]);

export type ShotStep = z.output<typeof shotStepSchema>;

export interface Aspect {
  width: number;
  height: number;
}

export const cropSchema = z.strictObject({
  target: locatorSchema.describe("The element framed: exactly one match (nth picks one of several)."),
  aspect: z
    .string()
    .regex(ASPECT_PATTERN, "must be W:H with whole numbers, e.g. 4:3")
    .transform((value): Aspect => {
      const [width, height] = value.split(":").map(Number);
      return { width: width ?? 1, height: height ?? 1 };
    })
    .describe("The frame's width to height, e.g. 4:3: as wide as the element (plus padding), from its top edge down."),
  padding: z.number().int().min(0).max(200).default(0).describe("CSS pixels of the page around the element on the left, right and top (0-200, default 0)."),
});

export type Crop = z.output<typeof cropSchema>;
