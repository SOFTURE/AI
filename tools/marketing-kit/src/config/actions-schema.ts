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

export const ACTION_NAMES = ["wide", "tap", "type", "fill", "blur", "focus", "bring", "mark", "still", "cue", "hold", "until", "checkScreen"] as const;

export type ActionName = (typeof ACTION_NAMES)[number];

const LOCATOR_KINDS = ["role", "text", "label", "testId", "css"] as const;
const REGEX_FLAGS_PATTERN = /^(?!.*(.).*\1)[imsu]*$/;
/** The Director types into `input[name=…]` unquoted, so the name must be a CSS identifier. */
const INPUT_NAME_PATTERN = /^[A-Za-z_][A-Za-z0-9_-]*$/;

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
      regex: z.string().min(1),
      /** Any of `i`, `m`, `s`, `u`, each once. */
      flags: z.string().regex(REGEX_FLAGS_PATTERN, "must be any of i, m, s, u, each at most once").default(""),
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
    role: z.enum(ARIA_ROLES, { error: "must be an ARIA role Playwright knows, such as button, heading, link or textbox" }).optional(),
    /** The accessible name, with `role`. */
    name: textMatchSchema.optional(),
    text: textMatchSchema.optional(),
    label: textMatchSchema.optional(),
    testId: z.string().min(1).optional(),
    css: z.string().min(1).optional(),
    /** Only elements containing this text, with `css`. */
    hasText: textMatchSchema.optional(),
    /** Whole and case-sensitive string match, for `name`, `text` and `label`. */
    exact: z.boolean().optional(),
    /** The n-th match (0 = the first). Without it, a locator that matches several elements fails. */
    nth: z.number().int().min(0).optional(),
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
const targetsSchema = z.union([locatorSchema, z.array(locatorSchema).min(1, "needs at least one locator")]);

const scale = z.number().min(0.5).max(4);
const seconds = z.number().min(0).max(10);
const nonEmpty = z.string().min(1);

export const actionSchema = z.discriminatedUnion("do", [
  /** Camera on the whole phone screen. */
  z.strictObject({ do: z.literal("wide"), scale: scale.optional(), whoosh: z.boolean().optional() }),
  z.strictObject({ do: z.literal("tap"), target: locatorSchema, after: seconds.optional() }),
  /** Types into the focused element, one key at a time. */
  z.strictObject({ do: z.literal("type"), text: nonEmpty, perChar: seconds.optional() }),
  /** Taps `input[name=<input>]`, moves the camera onto it and types the value. */
  z.strictObject({ do: z.literal("fill"), input: z.string().regex(INPUT_NAME_PATTERN, "must be an input name such as age or returnRate"), value: z.string() }),
  z.strictObject({ do: z.literal("blur") }),
  z.strictObject({ do: z.literal("focus"), target: targetsSchema, scale: scale.optional(), height: z.number().int().min(1).max(4000).optional() }),
  /** Scrolls so the element's top edge stands `top` px from the top of the screen. */
  z.strictObject({ do: z.literal("bring"), target: locatorSchema, top: z.number().int().min(-4000).max(4000).optional(), seconds: seconds.optional() }),
  z.strictObject({ do: z.literal("mark"), name: nonEmpty, target: targetsSchema }),
  z.strictObject({ do: z.literal("still"), name: nonEmpty }),
  z.strictObject({ do: z.literal("cue"), name: z.enum(CUES) }),
  z.strictObject({ do: z.literal("hold"), seconds: z.number().min(0).max(30) }),
  /** Waits until the voiceover says this word of the current sentence. */
  z.strictObject({ do: z.literal("until"), word: nonEmpty }),
  z.strictObject({ do: z.literal("checkScreen") }),
]);

export type SceneAction = z.output<typeof actionSchema>;
export type SceneActionInput = z.input<typeof actionSchema>;
