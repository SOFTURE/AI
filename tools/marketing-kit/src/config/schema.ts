import { z } from "zod";

import {
  DEVICE_KINDS,
  LAYOUTS,
  LAYOUT_NAMES,
  MIN_DESKTOP_WIDTH,
  TRANSITIONS,
  VIDEO_FORMATS,
  fitsFrame,
  isDesktopViewport,
  resolveLayout,
  type LayoutName,
} from "../compose/timeline.js";
import { MARKETING_LOCALES, type MarketingLocale } from "../messages/index.js";
import { bigNumberDataSchema, carouselDataSchema, headlineChartDataSchema, headlineCtaDataSchema } from "../og/templates/schemas.js";
import { CHANNEL_CODE_MAX_LENGTH, CHANNEL_CODE_PATTERN, DEFAULT_LINK_IN_BIO, PLATFORMS } from "../platforms.js";
import { ELEVENLABS_DEFAULT_MODEL } from "../voice/voiceover.js";
import { actionSchema, type SceneAction } from "./actions-schema.js";
import { COLOR_ROLES, COLOR_THEMES, isHexColor, type ColorRole } from "./colors.js";
import { DAY_PATTERN, isCalendarDay } from "./day.js";
import { getOgImageNames } from "./og-image-names.js";
import { getScreenshotNames } from "./screenshot-names.js";

/**
 * `marketing.json`: everything product-specific about a project's marketing material. One zod schema
 * is the contract; `schema/marketing.schema.json` is generated from it (`npm run schema`). Paths are
 * relative to the folder of the config file. Refinements that span fields name the path they check,
 * so every error points at the key to fix. Every key carries a `.describe()`: the text an editor shows
 * for it in marketing.json (tests/schema.test.ts refuses a key without one).
 */

export const DEFAULT_CONFIG_FILE = "marketing.json";

export const QUALITIES = ["draft", "standard", "high"] as const;

export type Quality = (typeof QUALITIES)[number];

export const SFX_EVENTS = ["tap", "key", "whoosh", "sparkle", "pop"] as const;

export type SfxEvent = (typeof SFX_EVENTS)[number];

const ID_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const TOKEN_NAME_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/;
/** No braces, semicolons, angle brackets, backslashes or comment openers: the selector lands inside a <style>. */
const SELECTOR_PATTERN = /^(?!.*\/\*)[^{};<>\\]+$/;
const FONT_FILE_PATTERN = /\.(?:woff2|woff|ttf|otf)$/i;
const FONT_FAMILY_PATTERN = /^[A-Za-z0-9][A-Za-z0-9 _-]*$/;
const FONT_WEIGHT_RANGE_PATTERN = /^\d{1,4}( \d{1,4})?$/;
const UNICODE_RANGE_PATTERN = /^U\+[0-9A-Fa-f?]{1,6}(-[0-9A-Fa-f]{1,6})?(, ?U\+[0-9A-Fa-f?]{1,6}(-[0-9A-Fa-f]{1,6})?)*$/;
const LOCALE_PATTERN = /^[a-z]{2,3}(-[A-Za-z0-9]{2,8})*$/;
const LANGUAGE_PATTERN = /^[a-z]{2,3}$/;

const nonEmpty = z.string().min(1);
const nonBlank = z.string().refine((value) => value.trim().length > 0, "must not be blank");
const relativePath = z.string().min(1).describe("A path relative to the folder of marketing.json.");
const id = z.string().regex(ID_PATTERN, "must be lowercase letters, digits and hyphens, e.g. calculator-tour");
const hexColor = z.string().refine(isHexColor, "must be a hex colour such as #0c0c0d");
const pagePath = z.string().startsWith("/", "must start with /");
const pixels = (max: number) => z.number().int().min(1).max(max);

/** An IANA zone name as written in the tz database (`Europe/London`, `UTC`), not an offset such as `+01:00`. */
const TIMEZONE_PATTERN = /^[A-Za-z][A-Za-z0-9_+-]*(?:\/[A-Za-z0-9_+-]+)*$/;

function isKnownTimezone(zone: string): boolean {
  if (!TIMEZONE_PATTERN.test(zone)) return false;
  try {
    // An unknown zone throws RangeError; `Intl.supportedValuesOf` would miss aliases such as UTC.
    const resolved = new Intl.DateTimeFormat("en", { timeZone: zone }).resolvedOptions().timeZone;
    // Intl accepts any case; the config takes the tz database spelling only (`europe/london` is refused),
    // the one every consumer, the browser's timezone emulation included, is sure to accept.
    return resolved === zone || resolved.toLowerCase() !== zone.toLowerCase();
  } catch {
    return false;
  }
}

function hasMessages(locale: string): boolean {
  const language = locale.split("-")[0];
  return MARKETING_LOCALES.some((known: MarketingLocale) => known === language);
}

function getWords(sentence: string): string[] {
  return sentence.split(/\s+/).map((word) => word.replace(/[.,?!:;]/g, ""));
}

const channelCode = z
  .string()
  .max(CHANNEL_CODE_MAX_LENGTH, `must be at most ${CHANNEL_CODE_MAX_LENGTH} characters`)
  .regex(CHANNEL_CODE_PATTERN, "must be lowercase words joined by single dashes or underscores, e.g. ig-01");

const fontSchema = z.strictObject({
  family: z.string().regex(FONT_FAMILY_PATTERN, "must be letters, digits, spaces, - and _").describe("The CSS family name the composition declares and uses, e.g. Inter."),
  fallback: z
    .enum(["serif", "sans-serif", "monospace", "system-ui"])
    .default("sans-serif")
    .describe("The generic family used while the files load, or alone when there are no files."),
  files: z
    .array(
      z.strictObject({
        path: relativePath.regex(FONT_FILE_PATTERN, "must be a .woff2, .woff, .ttf or .otf file").describe("The font file (.woff2, .woff, .ttf or .otf), relative to the folder of marketing.json."),
        weight: z
          .union([z.number().int().min(1).max(1000), z.string().regex(FONT_WEIGHT_RANGE_PATTERN, 'must be a weight such as 400 or a range such as "100 900"')])
          .describe('The weight this file draws (400), or a variable font\'s range ("100 900").'),
        style: z.enum(["normal", "italic"]).default("normal").describe("Whether this file is the upright or the italic face."),
        unicodeRange: z
          .string()
          .regex(UNICODE_RANGE_PATTERN, "must be a CSS unicode-range such as U+0000-00FF,U+20AC")
          .optional()
          .describe("The characters this file covers, as a CSS unicode-range (U+0000-00FF,U+20AC); without it, all of them."),
      }),
    )
    .default([])
    .describe("The files of the family: one or more per weight and style, e.g. Fontsource's latin and latin-ext subsets of one weight, each with its unicodeRange. The film picks the file of a character by unicodeRange; OG images try the files in the listed order. None: only the fallback is used."),
});

/** What each colour role paints; the descriptions of `brand.colors` and `brand.tokensFrom.roles`. */
const COLOR_ROLE_DESCRIPTIONS: Record<ColorRole, string> = {
  background: "The frame behind the phone and the vignette; #rrggbb, because the vignette appends an alpha.",
  foreground: "Text on the background: the persona card's name, the end card.",
  muted: "Secondary text: the persona card's tagline, the end card's note.",
  accent: "The touch ring and the end of the avatar's gradient.",
  cta: "The end card's link pill and the start of the avatar's gradient.",
  onCta: "Text on the cta colour.",
  captionBackground: "The caption pill.",
  captionText: "Caption words not spoken yet.",
  captionHighlight: "The word being spoken.",
};

const colorRolesShape = Object.fromEntries(
  COLOR_ROLES.map((role) => [role, hexColor.optional().describe(`${COLOR_ROLE_DESCRIPTIONS[role]} A hex colour; without it, the colour comes from tokensFrom.`)]),
) as Record<
  (typeof COLOR_ROLES)[number],
  z.ZodOptional<typeof hexColor>
>;

const tokenName = z.string().regex(TOKEN_NAME_PATTERN, "must be a token name such as accent-fill");

const roleTokensShape = Object.fromEntries(
  COLOR_ROLES.map((role) => [role, tokenName.optional().describe(`The source token for the ${role} role (${COLOR_ROLE_DESCRIPTIONS[role]}) Default: the role's name in kebab case.`)]),
) as Record<
  (typeof COLOR_ROLES)[number],
  z.ZodOptional<typeof tokenName>
>;

const brandSchema = z.strictObject({
  name: nonEmpty.describe("The product's name, shown on the end card."),
  locale: z
    .string()
    .regex(LOCALE_PATTERN, "must be a BCP 47 locale such as en-US")
    .refine(hasMessages, `needs a language with message dictionaries: ${MARKETING_LOCALES.join(", ")}`)
    .describe(`BCP 47 locale (en-US): the recording browser's locale, <html lang> and the language of the copy. Its language needs a message dictionary: ${MARKETING_LOCALES.join(", ")}.`),
  timezone: z.string().refine(isKnownTimezone, "must be an IANA timezone such as Europe/London").describe("IANA zone of the recording browser, e.g. Europe/London."),
  logo: z
    .strictObject({ svg: relativePath.endsWith(".svg", "must be an .svg file").describe("The logo as an .svg file, relative to the folder of marketing.json.") })
    .optional()
    .describe("The end card's logo next to the name; without it, the name alone."),
  colors: z.strictObject(colorRolesShape).prefault({}).describe("The colour roles as hex colours; a colour set here wins over tokensFrom."),
  tokensFrom: z
    .strictObject({
      css: relativePath.optional().describe("The app's stylesheet whose custom properties hold the tokens; give this or designJson."),
      designJson: relativePath.optional().describe("An Impeccable design.json (schemaVersion 2) holding the tokens; give this or css."),
      theme: z.enum(COLOR_THEMES).default("dark").describe("Which theme's token values to read."),
      roles: z
        .strictObject(roleTokensShape)
        .prefault({})
        .describe("The source token each role reads; by default the role's own name in kebab case (onCta reads on-cta)."),
    })
    .refine((source) => (source.css === undefined) !== (source.designJson === undefined), "needs exactly one of css and designJson")
    .optional()
    .describe("Where the colours not set in colors come from: the app's stylesheet or an Impeccable design.json."),
  fonts: z
    .strictObject({
      heading: fontSchema.optional().describe("The end card's and the avatar's font; without it, the body font."),
      body: fontSchema.optional().describe("The captions' and the cards' font; without it, the system's sans-serif."),
    })
    .prefault({})
    .describe("The brand fonts the composition loads."),
});

/**
 * The recording device. A phone's viewport must fit the 9:16 phone box; a desktop's must be a landscape browser at
 * least `MIN_DESKTOP_WIDTH` wide, and a desktop is never a mobile browser.
 */
const deviceSchema = z
  .strictObject({
    kind: z
      .enum(DEVICE_KINDS)
      .default("phone")
      .describe("What records the film: a phone (touch, framed as a phone) or a desktop browser (mouse, framed as a browser window, 16:9 films only)."),
    viewport: z
      .tuple([pixels(2000), pixels(4000)])
      .describe(`The recorded screen in CSS pixels, [width, height]; a phone's at most about 2.6 times as tall as wide, a desktop's at least ${MIN_DESKTOP_WIDTH} wide and not taller than wide.`),
    scale: z.number().min(1).max(4).describe("Device pixels per CSS pixel (1-4); a phone needs about 1080 / (640 / width) to stay sharp, a desktop 1.5-2."),
    mobile: z.boolean().optional().describe("Whether a phone's browser behaves as a mobile one (mobile viewport, default true); not allowed on a desktop."),
  })
  .superRefine((device, context) => {
    const viewport = { width: device.viewport[0], height: device.viewport[1] };
    if (device.kind === "phone") {
      if (!fitsFrame(viewport)) context.addIssue({ code: "custom", path: ["viewport"], message: "is too tall for the 9:16 frame (height at most about 2.6 × width)" });
      return;
    }
    if (device.mobile !== undefined) context.addIssue({ code: "custom", path: ["mobile"], message: "is a phone's setting; a desktop browser is never a mobile one, so remove it" });
    if (!isDesktopViewport(viewport)) {
      context.addIssue({ code: "custom", path: ["viewport"], message: `a desktop viewport is at least ${MIN_DESKTOP_WIDTH} px wide and not taller than wide` });
    }
  });

const appSchema = z.strictObject({
  baseUrl: z.url().describe("Where an already running app answers, e.g. http://localhost:3000."),
  port: z.number().int().min(1).max(65535).describe("Port of the app the CLI starts itself when baseUrl does not answer."),
  startCommand: z
    .array(nonEmpty)
    .min(1)
    .describe("The command that starts the app, as arguments (no shell), run in the folder of marketing.json; {port} is replaced by port."),
  colorScheme: z.enum(COLOR_THEMES).default("light").describe("The colour scheme the recording browser prefers."),
  hideSelectors: z
    .array(z.string().regex(SELECTOR_PATTERN, "must be a CSS selector without { } ; < > \\ or /*"))
    .default([])
    .describe("CSS selectors of elements hidden while recording, e.g. a dev overlay or a floating banner."),
  screenGuardSelector: z
    .string()
    .regex(SELECTOR_PATTERN, "must be a CSS selector without { } ; < > \\ or /*")
    .default("body")
    .describe("The element whose text the screen guard reads."),
  device: deviceSchema.describe("The recording device (a phone or a desktop browser); a video can override it."),
});

const tempo = z.number().min(0.8).max(1.3);

const voiceSchema = z.strictObject({
  provider: z.enum(["elevenlabs"]).default("elevenlabs").describe("The text-to-speech service that records the voiceover."),
  voiceId: nonEmpty.describe("The provider's id of the voice; part of the voiceover cache key."),
  model: nonEmpty.default(ELEVENLABS_DEFAULT_MODEL).describe("The provider's speech model; part of the voiceover cache key."),
  language: z
    .string()
    .regex(LANGUAGE_PATTERN, "must be an ISO 639 language code such as en")
    .describe("ISO 639 code the voice speaks (en, pl); part of the voiceover cache key."),
  tempo: tempo.default(1).describe("Speed-up (0.8-1.3) applied at build time, not in the API, so the paid cache stays valid."),
  minIntervalSeconds: z
    .number()
    .min(0)
    .max(3600)
    .default(60)
    .describe("Least seconds between two paid recordings (0-3600, default 60; 0 turns it off), counted from the newest file in cacheDir, so separate runs are spaced too."),
  cacheDir: relativePath.default("marketing/voiceover").describe("The paid voiceover cache (<key>.mp3 and <key>.json), relative to the folder of marketing.json; commit it."),
});

type VideoBeat = { id: string; text: string; pad?: number | undefined; actions?: SceneAction[] | undefined };

interface SceneShape {
  beats: VideoBeat[];
  hook: { still: string; shots: { mark: string }[]; transition: string };
  sceneModule?: string | undefined;
}

/**
 * A video's scene is either a `sceneModule` or the beats' `actions`, never both. With actions, what
 * the recording would only find out at its end is checked here, by path: the words `until` waits for,
 * the opening still and marks, and the screen guard.
 */
function checkScene(video: SceneShape, context: z.RefinementCtx): void {
  const [opening, ...sceneBeats] = video.beats;
  for (const key of ["actions", "pad"] as const) {
    if (opening?.[key] !== undefined) {
      context.addIssue({ code: "custom", path: ["beats", 0, key], message: "the opening sentence plays over the still; the scene starts at the second sentence" });
    }
  }
  if (video.sceneModule !== undefined) {
    video.beats.forEach((beat, index) => {
      for (const key of ["actions", "pad"] as const) {
        if (index > 0 && beat[key] !== undefined) {
          context.addIssue({ code: "custom", path: ["beats", index, key], message: "the video has a sceneModule; use one or the other" });
        }
      }
    });
    return;
  }
  const stills = new Set<string>();
  const marks = new Set<string>();
  let hasCheckScreen = false;
  sceneBeats.forEach((beat, offset) => {
    const index = offset + 1;
    if (beat.actions === undefined) {
      context.addIssue({ code: "custom", path: ["beats", index, "actions"], message: "is required when the video has no sceneModule" });
      return;
    }
    const words = getWords(beat.text);
    beat.actions.forEach((action, actionIndex) => {
      if (action.do === "until" && !words.includes(action.word)) {
        context.addIssue({ code: "custom", path: ["beats", index, "actions", actionIndex, "word"], message: `"${action.word}" is not a word of this sentence (${words.join(" ")})` });
      }
      if (action.do === "still") stills.add(action.name);
      if (action.do === "mark") marks.add(action.name);
      if (action.do === "checkScreen") hasCheckScreen = true;
    });
  });
  if (sceneBeats.some((beat) => beat.actions === undefined)) return;
  if (!stills.has(video.hook.still)) context.addIssue({ code: "custom", path: ["hook", "still"], message: `no "still" action saves "${video.hook.still}"` });
  video.hook.shots.forEach((shot, index) => {
    if (!marks.has(shot.mark)) context.addIssue({ code: "custom", path: ["hook", "shots", index, "mark"], message: `no "mark" action saves "${shot.mark}"` });
  });
  if (!hasCheckScreen) context.addIssue({ code: "custom", path: ["beats"], message: 'needs a "checkScreen" action: the screen guard must run before the film can say what the screen shows' });
}

const videoSchema = z
  .strictObject({
    id: id.describe("The film's id: its folder under output.dir and the name social.posts refer to."),
    title: nonEmpty.describe("The film's title: the heading of its posts.md and the composition's <title>."),
    path: pagePath.describe("The recorded page of the app, e.g. /calculator."),
    format: z
      .enum(VIDEO_FORMATS)
      .default("9:16")
      .describe("The film's aspect ratio: 9:16 (full screen), 1:1 or 16:9 (a framed phone next to the copy, or a browser window with a desktop device)."),
    device: deviceSchema.optional().describe("The recording device for this film; without it, app.device."),
    voice: z
      .strictObject({
        voiceId: nonEmpty.optional().describe("This film's voice; without it, voice.voiceId."),
        model: nonEmpty.optional().describe("This film's speech model; without it, voice.model."),
        tempo: tempo.optional().describe("This film's speed-up (0.8-1.3); without it, voice.tempo."),
      })
      .optional()
      .describe("Voice settings for this film only; each key falls back to voice."),
    persona: z
      .strictObject({
        name: nonEmpty.describe("The persona's name on the persona card."),
        age: z.number().int().min(0).max(150).describe("The persona's age on the persona card."),
        tagline: z.string().describe("One line about the persona under the name."),
      })
      .describe("The person the film is about, on the persona card from the start of the scene until the persona-out cue or the end card."),
    beats: z
      .array(
        z.strictObject({
          id: id.describe("The sentence's id, unique within the film."),
          text: nonBlank.describe("What the voiceover says; also the captions."),
          pad: z.number().min(0).max(5).optional().describe("Seconds held after the voiceover ends the sentence (0-5, default 0.35); only with actions."),
          actions: z
            .array(actionSchema)
            .optional()
            .describe("What happens on screen during the sentence, in order; required on every sentence after the first when the film has no sceneModule."),
        }),
      )
      .min(3, "a film needs at least three sentences: opening, scene, end card")
      .describe("Voiceover sentences in order (at least three): the first plays over the opening frame, the scene records the rest, the last ends with the end card."),
    hook: z
      .strictObject({
        still: nonEmpty.describe("The name of the still action whose frame opens the film."),
        shots: z
          .array(
            z.strictObject({
              mark: nonEmpty.describe("The name of the mark action whose rectangle this shot frames."),
              scale: z.number().min(0.5).max(4).describe("Camera zoom on the mark (0.5-4)."),
              word: nonEmpty.optional().describe("The word of the first sentence on which this shot starts; required on every shot after the first, which starts with the film."),
            }),
          )
          .min(1, "the opening needs at least one shot")
          .describe("Camera moves over the opening frame, at least one."),
        transition: z
          .enum(TRANSITIONS)
          .default("fade")
          .describe("How the opening frame hands over to the scene: fade (a 0.8 s cross-fade), rewind (0.8 s back through the scene in five dissolving frames) or cut."),
      })
      .describe("The opening: the result frame the first sentence plays over."),
    today: z
      .string()
      .regex(DAY_PATTERN, "must be a day as YYYY-MM-DD")
      .refine(isCalendarDay, "is not a day of the calendar")
      .optional()
      .describe(
        "The day the app is recorded as of (YYYY-MM-DD): pin it once the voiceover is paid for, so the numbers it says still match the screen in a later month. --today overrides it; without either, the day of the run.",
      ),
    screenGuard: z
      .array(nonBlank)
      .min(1, "the screen guard needs at least one phrase")
      .describe("Phrases the voiceover says that the screen must show; a missing one stops the recording."),
    endCard: z
      .strictObject({
        headline: nonEmpty.describe("The end card's headline."),
        url: nonEmpty.describe("The address shown in the end card's link pill, as written (e.g. example.com)."),
        note: z.string().default("").describe("A small line under the link; empty: none."),
      })
      .describe("The closing card shown during the last sentence."),
    sceneModule: relativePath
      .optional()
      .describe("A TS module exporting scene(director), relative to the folder of marketing.json: what happens on screen, instead of beat actions."),
  })
  .superRefine((video, context) => {
    checkScene(video, context);
    const seen = new Set<string>();
    video.beats.forEach((beat, index) => {
      if (seen.has(beat.id)) context.addIssue({ code: "custom", path: ["beats", index, "id"], message: `"${beat.id}" appears twice` });
      seen.add(beat.id);
    });
    const hookWords = getWords(video.beats[0]?.text ?? "");
    video.hook.shots.forEach((shot, index) => {
      // Only the first shot starts with the film; every later one starts on a word of the opening sentence.
      if (shot.word === undefined && index > 0) {
        context.addIssue({ code: "custom", path: ["hook", "shots", index, "word"], message: "every shot after the first needs the word of the first sentence it starts on" });
      }
      if (shot.word !== undefined && !hookWords.includes(shot.word)) {
        context.addIssue({ code: "custom", path: ["hook", "shots", index, "word"], message: `"${shot.word}" is not a word of the first sentence` });
      }
    });
  });

const LINK_IN_BIO_DEFAULTS = PLATFORMS.filter((platform) => DEFAULT_LINK_IN_BIO[platform]).join(", ");

const socialSchema = z.strictObject({
  linkTemplate: z
    .string()
    .refine((template) => template.includes("{code}"), "must contain {code}")
    .refine((template) => URL.canParse(template.replaceAll("{code}", "code")), "must be an absolute URL")
    .describe("The absolute link every post carries, with {code} where the platform's channel code goes."),
  platforms: z
    .partialRecord(
      z.enum(PLATFORMS),
      z
        .strictObject({
          code: channelCode.describe("The channel code the platform's link carries, so a visit from the film is counted (e.g. ig-01)."),
          linkInBio: z
            .boolean()
            .optional()
            .describe(`Whether the caption points to the link in the bio instead of carrying it; default true for ${LINK_IN_BIO_DEFAULTS}.`),
        })
        .describe("The platform's channel code and link placement."),
    )
    .refine((platforms) => Object.keys(platforms).length > 0, "needs at least one platform")
    .describe(`The platforms posts go to, at least one: ${PLATFORMS.join(", ")}.`),
  posts: z
    .array(
      z.strictObject({
        video: id.describe("The id of the film in videos this post is for."),
        caption: z.string().describe("The post's text."),
        hashtags: z.array(z.string()).default([]).describe("Hashtags appended to the caption."),
        disclosure: z.boolean().default(true).describe("Whether social.disclosure follows this post's caption (default true)."),
        codes: z
          .partialRecord(z.enum(PLATFORMS), channelCode.describe("The platform's channel code for this film."))
          .optional()
          .describe("Channel codes for this film only, per platform; each falls back to platforms.<platform>.code."),
      }),
    )
    .default([])
    .describe("Post copy per film; a film without a post gets no posts.md."),
  disclosure: nonBlank
    .optional()
    .describe("A paragraph after every post's caption, e.g. that the persona is an example and the voice is AI-generated; {persona} becomes the film's persona name. A post opts out with disclosure: false."),
});

const screenshotSchema = z.strictObject({
  id: id.describe("The screenshot's id: the file <output.dir>/screenshots/<id>.png."),
  path: pagePath.describe("The page of the app to capture, e.g. /pricing."),
  width: pixels(8000).describe("The browser viewport's width in CSS pixels."),
  height: pixels(8000).describe("The browser viewport's height in CSS pixels."),
  full: z.boolean().default(false).describe("Capture the whole page, scrolled first so lazy images load, instead of the viewport."),
  expect: nonBlank.describe("A phrase the page must show within 5 s of loading, or the screenshot is refused."),
  motion: z.enum(["reduce", "no-preference"]).default("reduce").describe("The reduced-motion preference of the browser."),
  minBytes: z.number().int().min(0).default(40_000).describe("Smaller files are deleted and refused (a blank or broken page); applies to every file of the entry, whatever its scale."),
  scale: z.number().min(1).max(4).default(1).describe("Device pixels per CSS pixel (1-4): the PNG is width × scale by height × scale pixels, e.g. 2 for a retina store listing."),
  colorSchemes: z
    .array(z.enum(COLOR_THEMES))
    .min(1)
    .refine((schemes) => new Set(schemes).size === schemes.length, "lists a scheme twice")
    .optional()
    .describe('Capture each listed scheme into its own <id>-<scheme>.png, e.g. ["light", "dark"]; without it, one <id>.png in app.colorScheme.'),
});

/** Named sizes of `ogImages[].size`: the share card and the three social formats. */
export const OG_SIZE_PRESETS = {
  landscape: [1200, 630],
  portrait: [1080, 1350],
  square: [1080, 1080],
  story: [1080, 1920],
} as const satisfies Record<string, readonly [number, number]>;

type OgSizePreset = keyof typeof OG_SIZE_PRESETS;

/** A preset name or `[width, height]`; the loaded config always holds the pair. */
const ogSize = (preset: OgSizePreset) =>
  z
    .union([z.tuple([pixels(4000), pixels(4000)]), z.enum(Object.keys(OG_SIZE_PRESETS) as [OgSizePreset, ...OgSizePreset[]])])
    .transform((size): [number, number] => (typeof size === "string" ? [...OG_SIZE_PRESETS[size]] : size))
    .default([...OG_SIZE_PRESETS[preset]])
    .describe(
      `The image size: "landscape" (1200×630), "portrait" (1080×1350), "square" (1080×1080), "story" (1080×1920) or [width, height] in pixels; "${preset}" by default.`,
    );

const ogImageId = id.describe("The image's id: the file <output.dir>/og/<id>.png (a carousel writes <id>-1.png, <id>-2.png and so on).");

/** One entry per template; `data` is the template's input, and values the app computes (charts) arrive precomputed. */
const ogImageSchema = z.discriminatedUnion("template", [
  z.strictObject({
    id: ogImageId,
    size: ogSize("landscape"),
    template: z.literal("headline-cta").describe("A headline with an optional eyebrow, call to action and tiles."),
    data: headlineCtaDataSchema.describe("The headline-cta template's input."),
  }),
  z.strictObject({
    id: ogImageId,
    size: ogSize("landscape"),
    template: z.literal("headline-chart").describe("A headline over a chart the app computed, with optional tiles."),
    data: headlineChartDataSchema.describe("The headline-chart template's input."),
  }),
  z.strictObject({
    id: ogImageId,
    size: ogSize("portrait"),
    template: z.literal("big-number").describe("A portrait post whose number fills the frame, with the sentence that explains it, tiles, a call to action and a source line."),
    data: bigNumberDataSchema.describe("The big-number template's input."),
  }),
  z.strictObject({
    id: ogImageId,
    size: ogSize("portrait"),
    template: z.literal("carousel").describe("A numbered run of portrait slides sharing one look; each slide is its own file <id>-<n>.png."),
    data: carouselDataSchema.describe("The carousel template's input."),
  }),
]);

/** When each sound effect plays; the descriptions of the `sfx` keys. */
const SFX_DESCRIPTIONS: Record<SfxEvent, string> = {
  tap: "Played on every tap.",
  key: "Played on every typed key.",
  whoosh: "Played on camera moves that ask for it, into the opening and into the end card.",
  sparkle: "Played on the sparkle cue.",
  pop: "Played when the end card's link pill appears.",
};

const sfxShape = Object.fromEntries(
  SFX_EVENTS.map((event) => [event, relativePath.optional().describe(`${SFX_DESCRIPTIONS[event]} An audio file relative to the folder of marketing.json; without it, silence.`)]),
) as Record<SfxEvent, z.ZodOptional<typeof relativePath>>;

/** The narrowest text column an override may leave between a box's margins, in px. */
const MIN_TEXT_WIDTH = 200;

/**
 * One layout's override: every key optional, bounded by the layout's frame, and described with the layout's
 * default from `LAYOUTS`. The margins are checked on the merged box, so an override of one margin is refused
 * when the table's other margin leaves too little room.
 */
function layoutOverrideSchema(name: LayoutName) {
  const { frame, caption, persona, endCard, window } = LAYOUTS[name];
  const device = window === "phone" ? "phone" : "browser window";
  const x = (text: string, value: number) => z.number().int().min(0).max(frame.width).optional().describe(`${text} Default ${value}.`);
  const y = (text: string, value: number) => z.number().int().min(0).max(frame.height).optional().describe(`${text} Default ${value}.`);
  return z
    .strictObject({
      caption: z
        .strictObject({
          top: y("The caption's top edge, in px from the frame's top.", caption.top),
          left: x("The caption's left margin, in px from the frame's left edge.", caption.left),
          right: x("The caption's right margin, in px from the frame's right edge.", caption.right),
          fontSize: z.number().int().min(16).max(200).optional().describe(`The caption's font size in px (16-200). Default ${caption.fontSize}.`),
        })
        .optional()
        .describe("The caption box over the film and its font size."),
      persona: z
        .strictObject({
          top: y("The persona card's top edge, in px from the frame's top.", persona.top),
          left: x("The persona card's left margin, in px from the frame's left edge.", persona.left),
          right: x("The persona card's right margin, in px from the frame's right edge.", persona.right),
        })
        .optional()
        .describe("The box the persona card is centred in."),
      endCard: z
        .strictObject({
          top: y("The end card's top edge, in px from the frame's top.", endCard.top),
          left: x("The end card's left margin, in px from the frame's left edge.", endCard.left),
          right: x("The end card's right margin, in px from the frame's right edge.", endCard.right),
          headlineSize: z.number().int().min(16).max(300).optional().describe(`The end card's headline size in px (16-300). Default ${endCard.headlineSize}.`),
          phone: z
            .strictObject({
              scale: z.number().min(0.2).max(1.5).optional().describe(`The ${device}'s scale while the end card shows (0.2-1.5). Default ${endCard.phone.scale}.`),
              center: z
                .strictObject({
                  x: x("Where the screen's centre goes, in px from the frame's left edge.", endCard.phone.center.x),
                  y: y("Where the screen's centre goes, in px from the frame's top.", endCard.phone.center.y),
                })
                .optional()
                .describe(`Where the ${device}'s screen centre goes while the end card shows.`),
            })
            .optional()
            .describe(`The ${device}'s pose while the end card shows.`),
        })
        .optional()
        .describe(`The end card's box, headline size and the ${device}'s pose behind it.`),
    })
    .superRefine((override, context) => {
      const layout = resolveLayout(name, override);
      for (const box of ["caption", "persona", "endCard"] as const) {
        const width = frame.width - layout[box].left - layout[box].right;
        if (width < MIN_TEXT_WIDTH) {
          context.addIssue({ code: "custom", path: [box], message: `left and right margins leave ${width} px for the text; at least ${MIN_TEXT_WIDTH}` });
        }
      }
    });
}

const layoutSchema = z.strictObject(
  Object.fromEntries(
    LAYOUT_NAMES.map((name) => {
      const { width, height } = LAYOUTS[name].frame;
      const films = name === "desktop" ? "desktop (16:9, browser window)" : `${name} phone`;
      return [name, layoutOverrideSchema(name).optional().describe(`Overrides for every ${films} film (${width}×${height} px); a missing key keeps the default.`)];
    }),
  ) as Record<LayoutName, z.ZodOptional<ReturnType<typeof layoutOverrideSchema>>>,
);

export const marketingSchema = z
  .strictObject({
    $schema: z.string().optional().describe("The JSON Schema this file follows, for editor completion and these descriptions."),
    brand: brandSchema.describe("The product's name, language, colours, fonts and logo."),
    app: appSchema.describe("The app the films and screenshots are recorded from."),
    voice: voiceSchema.describe("The voiceover: provider, voice, language and the paid cache."),
    videos: z.array(videoSchema).min(1, "needs at least one video").describe("The films, at least one."),
    social: socialSchema.optional().describe("Post copy for the films: the link, the platforms and their channel codes."),
    screenshots: z.array(screenshotSchema).default([]).describe("Screenshots taken by softure-marketing shots."),
    ogImages: z.array(ogImageSchema).default([]).describe("Open Graph images rendered by softure-marketing og."),
    layout: layoutSchema
      .optional()
      .describe("Per format (9:16, 1:1, 16:9 for phone films; desktop for desktop films), overrides of where the caption, the persona card and the end card go, and the end card's phone or window pose."),
    sfx: z.strictObject(sfxShape).prefault({}).describe("Sound effects of the composition; a missing one is silent."),
    output: z
      .strictObject({
        dir: relativePath.default("marketing/out").describe("Finished films and post copy (<dir>/<video>/), relative to the folder of marketing.json; not committed."),
        buildDir: relativePath.default("marketing/build").describe("Recordings and compositions (<buildDir>/<video>/), relative to the folder of marketing.json; not committed."),
        quality: z.enum(QUALITIES).default("standard").describe("The render quality; the --quality flag wins."),
      })
      .prefault({})
      .describe("Where the outputs go and at what quality."),
  })
  .superRefine((config, context) => {
    const checkUnique = (key: "videos" | "screenshots" | "ogImages") => {
      const seen = new Set<string>();
      config[key].forEach((entry, index) => {
        if (seen.has(entry.id)) context.addIssue({ code: "custom", path: [key, index, "id"], message: `"${entry.id}" appears twice` });
        seen.add(entry.id);
      });
    };
    checkUnique("videos");
    config.videos.forEach((video, index) => {
      const device = video.device ?? config.app.device;
      if (device.kind === "desktop" && video.format !== "16:9") {
        context.addIssue({ code: "custom", path: ["videos", index, "format"], message: `is ${video.format}, but a desktop device records 16:9 films only` });
      }
    });
    checkUnique("screenshots");
    checkUnique("ogImages");
    const ogFileOwners = new Map<string, number>();
    config.ogImages.forEach((entry, index) => {
      for (const name of getOgImageNames(entry)) {
        const owner = ogFileOwners.get(name);
        // Two entries with one id are reported by checkUnique already.
        if (owner !== undefined && owner !== index && config.ogImages[owner]?.id !== entry.id) {
          context.addIssue({ code: "custom", path: ["ogImages", index, "id"], message: `writes og/${name}.png, as ogImages[${String(owner)}] does` });
        }
        ogFileOwners.set(name, owner ?? index);
      }
    });
    const fileOwners = new Map<string, number>();
    config.screenshots.forEach((entry, index) => {
      for (const name of getScreenshotNames(entry.id)) {
        const owner = fileOwners.get(name);
        if (owner !== undefined && owner !== index) {
          context.addIssue({ code: "custom", path: ["screenshots", index, "id"], message: `may write ${name}.png, as screenshots[${owner}] may (<id>.png, <id>-light.png, <id>-dark.png)` });
        }
        fileOwners.set(name, owner ?? index);
      }
    });
    const videoIds = new Set(config.videos.map((video) => video.id));
    const posted = new Set<string>();
    config.social?.posts.forEach((post, index) => {
      if (!videoIds.has(post.video)) {
        context.addIssue({ code: "custom", path: ["social", "posts", index, "video"], message: `no video "${post.video}" in videos` });
      }
      if (posted.has(post.video)) context.addIssue({ code: "custom", path: ["social", "posts", index, "video"], message: `"${post.video}" has two posts` });
      posted.add(post.video);
      for (const platform of Object.keys(post.codes ?? {})) {
        if (!Object.hasOwn(config.social?.platforms ?? {}, platform)) {
          context.addIssue({ code: "custom", path: ["social", "posts", index, "codes", platform], message: `"${platform}" is not in social.platforms` });
        }
      }
    });
   })
  .describe("marketing.json: everything product-specific about a project's marketing material, for @softure-ai/marketing-kit.");

export type MarketingJson = z.output<typeof marketingSchema>;
export type MarketingJsonInput = z.input<typeof marketingSchema>;

/** The URL `$schema` points at in a project's marketing.json. */
export const MARKETING_SCHEMA_URL = "https://unpkg.com/@softure-ai/marketing-kit/schema/marketing.schema.json";

/** The JSON Schema of the input a project writes (defaults are optional there). */
export function getMarketingJsonSchema(): Record<string, unknown> {
  return {
    ...z.toJSONSchema(marketingSchema, { io: "input" }),
    $id: MARKETING_SCHEMA_URL,
    title: "marketing.json for @softure-ai/marketing-kit",
  };
}
