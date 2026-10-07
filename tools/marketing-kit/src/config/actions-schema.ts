import { z } from "zod";

import { CUES } from "../film.js";

/**
 * A beat's `actions`: what happens on screen, written as data. Each action is
 * `{ "do": "<Director method>", …arguments }` and maps 1:1 to a Director call; targets are locator
 * descriptors that `src/record/actions.ts` turns into Playwright locators.
 */

/** The roles Playwright's `getByRole` accepts (a type test keeps the two lists in step). */
export const ARIA_ROLES = [
  "alert",
  "alertdialog",
  "application",
  "article",
  "banner",
  "blockquote",
  "button",
  "caption",
  "cell",
  "checkbox",
  "code",
  "columnheader",
  "combobox",
  "complementary",
  "contentinfo",
  "definition",
  "deletion",
  "dialog",
  "directory",
  "document",
  "emphasis",
  "feed",
  "figure",
  "form",
  "generic",
  "grid",
  "gridcell",
  "group",
  "heading",
  "img",
  "insertion",
  "link",
  "list",
  "listbox",
  "listitem",
  "log",
  "main",
  "marquee",
  "math",
  "meter",
  "menu",
  "menubar",
  "menuitem",
  "menuitemcheckbox",
  "menuitemradio",
  "navigation",
  "none",
  "note",
  "option",
  "paragraph",
  "presentation",
  "progressbar",
  "radio",
  "radiogroup",
  "region",
  "row",
  "rowgroup",
  "rowheader",
  "scrollbar",
  "search",
  "searchbox",
  "separator",
  "slider",
  "spinbutton",
  "status",
  "strong",
  "subscript",
  "superscript",
  "switch",
  "tab",
  "table",
  "tablist",
  "tabpanel",
  "term",
  "textbox",
  "time",
  "timer",
  "toolbar",
  "tooltip",
  "tree",
  "treegrid",
  "treeitem",
] as const;

export type AriaRole = (typeof ARIA_ROLES)[number];

export const ACTION_NAMES = ["wide", "tap", "type", "press", "fill", "blur", "focus", "bring", "mark", "still", "cue", "hold", "until", "checkScreen"] as const;

export type ActionName = (typeof ACTION_NAMES)[number];

const LOCATOR_KINDS = ["role", "text", "label", "testId", "css"] as const;
const REGEX_FLAGS_PATTERN = /^(?!.*(.).*\1)[imsu]*$/;
/** The Director types into `input[name=…]` unquoted, so the name must be a CSS identifier. */
const INPUT_NAME_PATTERN = /^[A-Za-z_][A-Za-z0-9_-]*$/;
/** A Playwright key name, modifiers joined with `+`; Playwright itself refuses a name it does not know. */
const KEY_PATTERN = /^\S+$/;

function compiles(source: string, flags: string): boolean {
  try {
    new RegExp(source, flags);
    return true;
  } catch {
    return false;
  }
}

/** A string (Playwright's substring match, or the whole text with `exact`) or a regular expression. */
export const textMatchSchema = z.union([
  z.string().min(1),
  z
    .strictObject({
      regex: z.string().min(1).describe("A JavaScript regular expression source, without slashes."),
      flags: z.string().regex(REGEX_FLAGS_PATTERN, "must be any of i, m, s, u, each at most once").default("").describe("Any of i, m, s, u, each at most once."),
    })
    // Bad flags are reported on their own key; the source is checked with valid ones only.
    .refine((match) => !REGEX_FLAGS_PATTERN.test(match.flags) || compiles(match.regex, match.flags), { message: "is not a valid regular expression", path: ["regex"] }),
]);

export type TextMatch = z.output<typeof textMatchSchema>;

/** A locator descriptor after validation: exactly one kind, with the options that kind takes. */
export type LocatorDescriptor =
  | { kind: "role"; role: AriaRole; name: TextMatch | null; exact: boolean; nth: number | null }
  | { kind: "text"; text: TextMatch; exact: boolean; nth: number | null }
  | { kind: "label"; label: TextMatch; exact: boolean; nth: number | null }
  | { kind: "testId"; testId: string; nth: number | null }
  | { kind: "css"; css: string; hasText: TextMatch | null; nth: number | null };

/**
 * One object with every key optional, checked by hand, then turned into the union: a plain zod union
 * would report a misspelt key as "Invalid input" at the descriptor instead of naming the key.
 */
export const locatorSchema = z
  .strictObject({
    role: z
      .enum(ARIA_ROLES, { error: "must be an ARIA role Playwright knows, such as button, heading, link or textbox" })
      .optional()
      .describe("Find by ARIA role (Playwright getByRole), e.g. button; narrow it with name."),
    name: textMatchSchema.optional().describe("The accessible name, with role: a string or { regex, flags }."),
    text: textMatchSchema.optional().describe("Find by visible text (Playwright getByText): a substring, or { regex, flags }."),
    label: textMatchSchema.optional().describe("Find a form control by its label (Playwright getByLabel): a substring, or { regex, flags }."),
    testId: z.string().min(1).optional().describe("Find by data-testid (Playwright getByTestId)."),
    css: z.string().min(1).optional().describe("Find by CSS selector; narrow it with hasText."),
    hasText: textMatchSchema.optional().describe("Only elements containing this text, with css."),
    exact: z.boolean().optional().describe("Whole and case-sensitive match of a string name, text or label (default false)."),
    nth: z.number().int().min(0).optional().describe("The n-th match (0 = the first); without it, a locator that matches several elements fails."),
  })
  .superRefine((descriptor, context) => {
    const kinds = LOCATOR_KINDS.filter((kind) => descriptor[kind] !== undefined);
    if (kinds.length !== 1) {
      const found = kinds.length === 0 ? "none" : kinds.join(", ");
      context.addIssue({ code: "custom", message: `needs exactly one of ${LOCATOR_KINDS.join(", ")} (found ${found})` });
    }
    if (descriptor.name !== undefined && descriptor.role === undefined) context.addIssue({ code: "custom", path: ["name"], message: "goes only with role" });
    if (descriptor.hasText !== undefined && descriptor.css === undefined) context.addIssue({ code: "custom", path: ["hasText"], message: "goes only with css" });
    if (descriptor.exact !== undefined) {
      const match = descriptor.role !== undefined ? descriptor.name : (descriptor.text ?? descriptor.label);
      if (typeof match !== "string") context.addIssue({ code: "custom", path: ["exact"], message: "goes only with a string name, text or label" });
    }
  })
  .transform((descriptor): LocatorDescriptor => {
    const nth = descriptor.nth ?? null;
    const exact = descriptor.exact ?? false;
    if (descriptor.role !== undefined) return { kind: "role", role: descriptor.role, name: descriptor.name ?? null, exact, nth };
    if (descriptor.text !== undefined) return { kind: "text", text: descriptor.text, exact, nth };
    if (descriptor.label !== undefined) return { kind: "label", label: descriptor.label, exact, nth };
    if (descriptor.testId !== undefined) return { kind: "testId", testId: descriptor.testId, nth };
    // The refinement above guarantees exactly one kind, so this is `css`.
    return { kind: "css", css: descriptor.css ?? "", hasText: descriptor.hasText ?? null, nth };
  });

/** One element, or several meaning the rectangle that encloses them all. */
const targetsSchema = z.union([locatorSchema, z.array(locatorSchema).min(1, "needs at least one locator")]).describe("One element, or several meaning the rectangle around them all.");

const scale = z.number().min(0.5).max(4);
const seconds = z.number().min(0).max(10);
const nonEmpty = z.string().min(1);

const target = locatorSchema.describe("The element, as a locator descriptor with exactly one of role, text, label, testId, css.");

export const actionSchema = z.discriminatedUnion("do", [
  z.strictObject({
    do: z.literal("wide").describe("Camera on the whole phone screen."),
    scale: scale.optional().describe("Camera zoom (0.5-4, default 1)."),
    whoosh: z.boolean().optional().describe("Play the whoosh sound with the move (default false)."),
  }),
  z.strictObject({
    do: z.literal("tap").describe("Scrolls the element into view if needed and taps its centre."),
    target,
    after: seconds.optional().describe("Seconds held after the tap (0-10, default 0.35)."),
  }),
  z.strictObject({
    do: z.literal("type").describe("Types into the focused element, one key at a time."),
    text: nonEmpty.describe("The text to type."),
    perChar: seconds.optional().describe("Seconds per key (0-10, default 0.13)."),
  }),
  z.strictObject({
    do: z.literal("press").describe("Presses a key on the focused element, e.g. Backspace, Enter or ControlOrMeta+A."),
    key: z
      .string()
      .regex(KEY_PATTERN, "must be a key name such as Backspace, Enter or ControlOrMeta+A")
      .describe("A Playwright key name; modifiers joined with +, ControlOrMeta for the platform's shortcut key."),
    times: z.number().int().min(1).max(50).optional().describe("How many times the key is pressed (1-50, default 1)."),
    perKey: seconds.optional().describe("Seconds held after each press (0-10, default 0.13)."),
  }),
  z.strictObject({
    do: z.literal("fill").describe("Taps input[name=<input>], moves the camera onto it, deletes a value already there and types the value."),
    input: z.string().regex(INPUT_NAME_PATTERN, "must be an input name such as age or returnRate").describe("The name attribute of the input, e.g. age."),
    value: z.string().describe("The text typed into the input."),
    clear: z
      .boolean()
      .optional()
      .describe("Select and delete a value already in the input before typing, on screen (default true); false types after it."),
  }),
  z.strictObject({ do: z.literal("blur").describe("Takes the focus off the active element.") }),
  z.strictObject({
    do: z.literal("focus").describe("Camera on the element, or on the rectangle around several."),
    target: targetsSchema,
    scale: scale.optional().describe("Camera zoom (0.5-4); default: the zoom that fits the element."),
    height: z.number().int().min(1).max(4000).optional().describe("The height of the framed rectangle in CSS pixels, instead of the element's own."),
  }),
  z.strictObject({
    do: z.literal("bring").describe("Scrolls so the element's top edge stands top pixels from the top of the screen."),
    target,
    top: z.number().int().min(-4000).max(4000).optional().describe("Distance from the top of the screen in CSS pixels (default 140)."),
    seconds: seconds.optional().describe("Duration of the scroll in seconds (0-10, default 0.5)."),
  }),
  z.strictObject({
    do: z.literal("mark").describe("Remembers the element's rectangle under a name, e.g. for an opening shot (hook.shots[].mark)."),
    name: nonEmpty.describe("The name hook.shots refer to."),
    target: targetsSchema,
  }),
  z.strictObject({
    do: z.literal("still").describe("Remembers the current frame under a name, e.g. as the opening frame (hook.still)."),
    name: nonEmpty.describe("The name hook.still refers to."),
  }),
  z.strictObject({
    do: z.literal("cue").describe("Puts an event on the film's timeline."),
    name: z.enum(CUES).describe(`The event: ${CUES.join(", ")}.`),
  }),
  z.strictObject({
    do: z.literal("hold").describe("Lets the screen run."),
    seconds: z.number().min(0).max(30).describe("How long, in seconds (0-30)."),
  }),
  z.strictObject({
    do: z.literal("until").describe("Waits until the voiceover says a word of the current sentence."),
    word: nonEmpty.describe("A word of this sentence, punctuation ignored."),
  }),
  z.strictObject({ do: z.literal("checkScreen").describe("Runs the screen guard now: the video's screenGuard phrases and the current sentence's must be on screen.") }),
]);

export type SceneAction = z.output<typeof actionSchema>;
export type SceneActionInput = z.input<typeof actionSchema>;
