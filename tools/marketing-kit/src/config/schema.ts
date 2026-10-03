import { z } from "zod";

import { VIDEO_FORMATS, fitsFrame } from "../compose/timeline.js";
import { MARKETING_LOCALES, type MarketingLocale } from "../messages/index.js";
import { headlineChartDataSchema, headlineCtaDataSchema } from "../og/templates/schemas.js";
import { CHANNEL_CODE_MAX_LENGTH, CHANNEL_CODE_PATTERN, PLATFORMS } from "../platforms.js";
import { ELEVENLABS_DEFAULT_MODEL } from "../voice/voiceover.js";
import { actionSchema, type SceneAction } from "./actions-schema.js";
import { COLOR_ROLES, COLOR_THEMES, isHexColor } from "./colors.js";

/**
 * `marketing.json`: everything product-specific about a project's marketing material. One zod schema
 * is the contract; `schema/marketing.schema.json` is generated from it (`npm run schema`). Paths are
 * relative to the folder of the config file. Refinements that span fields name the path they check,
 * so every error points at the key to fix.
 */

export const DEFAULT_CONFIG_FILE = "marketing.json";

export const QUALITIES = ["draft", "standard", "high"] as const;

export type Quality = (typeof QUALITIES)[number];

export const SFX_EVENTS = ["tap", "key", "whoosh", "sparkle", "pop"] as const;

export type SfxEvent = (typeof SFX_EVENTS)[number];

const ID_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const TOKEN_NAME_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/;
/** Characters that would end a CSS rule or an HTML attribute; none belongs in a selector we inject. */
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
  /** The CSS family name the composition declares and uses. */
  family: z.string().regex(FONT_FAMILY_PATTERN, "must be letters, digits, spaces, - and _"),
  /** The generic family used while the files load or when there are none. */
  fallback: z.enum(["serif", "sans-serif", "monospace", "system-ui"]).default("sans-serif"),
  files: z
    .array(
      z.strictObject({
        path: relativePath.regex(FONT_FILE_PATTERN, "must be a .woff2, .woff, .ttf or .otf file"),
        /** A weight (`400`) or a variable font's range (`"100 900"`). */
        weight: z.union([z.number().int().min(1).max(1000), z.string().regex(FONT_WEIGHT_RANGE_PATTERN, 'must be a weight such as 400 or a range such as "100 900"')]),
        style: z.enum(["normal", "italic"]).default("normal"),
        unicodeRange: z.string().regex(UNICODE_RANGE_PATTERN, "must be a CSS unicode-range such as U+0000-00FF,U+20AC").optional(),
      }),
    )
    .default([]),
});

const colorRolesShape = Object.fromEntries(COLOR_ROLES.map((role) => [role, hexColor.optional()])) as Record<
  (typeof COLOR_ROLES)[number],
  z.ZodOptional<typeof hexColor>
>;

const tokenName = z.string().regex(TOKEN_NAME_PATTERN, "must be a token name such as accent-fill");

const roleTokensShape = Object.fromEntries(COLOR_ROLES.map((role) => [role, tokenName.optional()])) as Record<
  (typeof COLOR_ROLES)[number],
  z.ZodOptional<typeof tokenName>
>;

const brandSchema = z.strictObject({
  name: nonEmpty,
  /** BCP 47, e.g. `en-US`: the recording browser's locale, `<html lang>`, and the language of the copy. */
  locale: z
    .string()
    .regex(LOCALE_PATTERN, "must be a BCP 47 locale such as en-US")
    .refine(hasMessages, `needs a language with message dictionaries: ${MARKETING_LOCALES.join(", ")}`),
  /** IANA zone of the recording browser, e.g. `Europe/London`. */
  timezone: z.string().refine(isKnownTimezone, "must be an IANA timezone such as Europe/London"),
  logo: z.strictObject({ svg: relativePath.endsWith(".svg", "must be an .svg file") }).optional(),
  /** Colours set here win over `tokensFrom`. */
  colors: z.strictObject(colorRolesShape).prefault({}),
  /** Where the colours not set in `colors` come from: the app's stylesheet or an Impeccable design.json. */
  tokensFrom: z
    .strictObject({
      css: relativePath.optional(),
      designJson: relativePath.optional(),
      theme: z.enum(COLOR_THEMES).default("dark"),
      /** The source token each role reads; by default the role's own name in kebab case (`onCta` → `on-cta`). */
      roles: z.strictObject(roleTokensShape).prefault({}),
    })
    .refine((source) => (source.css === undefined) !== (source.designJson === undefined), "needs exactly one of css and designJson")
    .optional(),
  fonts: z.strictObject({ heading: fontSchema.optional(), body: fontSchema.optional() }).prefault({}),
});

const deviceSchema = z
  .strictObject({
    /** CSS pixels, [width, height]. */
    viewport: z.tuple([pixels(2000), pixels(4000)]),
    /** Device pixels per CSS pixel; the frame needs about 1080 / (640 / width) to stay sharp. */
    scale: z.number().min(1).max(4),
    mobile: z.boolean().default(true),
  })
  .refine((device) => fitsFrame({ width: device.viewport[0], height: device.viewport[1] }), {
    message: "is too tall for the 9:16 frame (height at most about 2.6 × width)",
    path: ["viewport"],
  });

const appSchema = z.strictObject({
  /** Where an already running app answers, e.g. `http://localhost:3000`. */
  baseUrl: z.url(),
  /** Port of the app the CLI starts itself when `baseUrl` does not answer. */
  port: z.number().int().min(1).max(65535),
  /** Command that starts the app, as arguments (no shell); `{port}` is replaced. Runs in the config folder. */
  startCommand: z.array(nonEmpty).min(1),
  colorScheme: z.enum(COLOR_THEMES).default("light"),
  /** Elements hidden while recording, e.g. a dev overlay or a floating banner. */
  hideSelectors: z.array(z.string().regex(SELECTOR_PATTERN, "must be a CSS selector without { } ; < > \\ or /*")).default([]),
  /** The element whose text the screen guard reads. */
  screenGuardSelector: z.string().regex(SELECTOR_PATTERN, "must be a CSS selector without { } ; < > \\ or /*").default("body"),
  /** The recorded phone; a video can override it. */
  device: deviceSchema,
});

const tempo = z.number().min(0.8).max(1.3);

const voiceSchema = z.strictObject({
  provider: z.enum(["elevenlabs"]).default("elevenlabs"),
  voiceId: nonEmpty,
  model: nonEmpty.default(ELEVENLABS_DEFAULT_MODEL),
  /** ISO 639 code the voice speaks (`en`, `pl`); part of the voiceover cache key. */
  language: z.string().regex(LANGUAGE_PATTERN, "must be an ISO 639 language code such as en"),
  /** Speed-up applied at build time, not in the API, so the paid cache stays valid. */
  tempo: tempo.default(1),
  /** The paid voiceover cache (`<key>.mp3` + `<key>.json`); commit it. */
  cacheDir: relativePath.default("marketing/voiceover"),
});

type VideoBeat = { id: string; text: string; pad?: number | undefined; actions?: SceneAction[] | undefined };

interface SceneShape {
  beats: VideoBeat[];
  hook: { still: string; shots: { mark: string }[] };
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
    id,
    title: nonEmpty,
    /** The recorded page, e.g. `/calculator`. */
    path: pagePath,
    format: z.enum(VIDEO_FORMATS).default("9:16"),
    device: deviceSchema.optional(),
    voice: z.strictObject({ voiceId: nonEmpty.optional(), model: nonEmpty.optional(), tempo: tempo.optional() }).optional(),
    persona: z.strictObject({ name: nonEmpty, age: z.number().int().min(0).max(150), tagline: z.string() }),
    /**
     * Voiceover sentences in order. The first plays over the opening (the result frame), the scene
     * records the rest, and the last ends with the end card.
     */
    beats: z
      .array(
        z.strictObject({
          id,
          text: nonBlank,
          /** Seconds held after the voiceover ends the sentence (default 0.35); only with `actions`. */
          pad: z.number().min(0).max(5).optional(),
          /** What happens on screen during the sentence, when the video has no `sceneModule`. */
          actions: z.array(actionSchema).optional(),
        }),
      )
      .min(3, "a film needs at least three sentences: opening, scene, end card"),
    hook: z.strictObject({
      /** The `still` the scene saves as the opening frame. */
      still: nonEmpty,
      shots: z
        .array(z.strictObject({ mark: nonEmpty, scale: z.number().min(0.5).max(4), word: nonEmpty.optional() }))
        .min(1, "the opening needs at least one shot"),
    }),
    /** Phrases the voiceover says that the screen must show; a missing one stops the recording. */
    screenGuard: z.array(nonBlank).min(1, "the screen guard needs at least one phrase"),
    endCard: z.strictObject({ headline: nonEmpty, url: nonEmpty, note: z.string().default("") }),
    /** A TS module exporting `scene(director)`: what happens on screen, instead of beat `actions`. */
    sceneModule: relativePath.optional(),
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
      if (shot.word !== undefined && !hookWords.includes(shot.word)) {
        context.addIssue({ code: "custom", path: ["hook", "shots", index, "word"], message: `"${shot.word}" is not a word of the first sentence` });
      }
    });
  });

const socialSchema = z.strictObject({
  /** The link each post carries, with `{code}` where the platform's channel code goes. */
  linkTemplate: z
    .string()
    .refine((template) => template.includes("{code}"), "must contain {code}")
    .refine((template) => URL.canParse(template.replaceAll("{code}", "code")), "must be an absolute URL"),
  platforms: z
    .partialRecord(z.enum(PLATFORMS), z.strictObject({ code: channelCode, linkInBio: z.boolean().optional() }))
    .refine((platforms) => Object.keys(platforms).length > 0, "needs at least one platform"),
  posts: z
    .array(
      z.strictObject({
        video: id,
        caption: z.string(),
        hashtags: z.array(z.string()).default([]),
        /** Channel codes for this video only. */
        codes: z.partialRecord(z.enum(PLATFORMS), channelCode).optional(),
      }),
    )
    .default([]),
});

const screenshotSchema = z.strictObject({
  id,
  path: pagePath,
  width: pixels(8000),
  height: pixels(8000),
  /** The whole page, scrolled first so lazy images load. */
  full: z.boolean().default(false),
  /** A phrase the page must show, or the screenshot is refused. */
  expect: nonBlank,
  motion: z.enum(["reduce", "no-preference"]).default("reduce"),
  /** Smaller files are deleted and refused (a blank or broken page). */
  minBytes: z.number().int().min(0).default(40_000),
});

const ogImageBase = {
  id,
  size: z.tuple([pixels(4000), pixels(4000)]).default([1200, 630]),
};

/** One entry per template; `data` is the template's input, and values the app computes (charts) arrive precomputed. */
const ogImageSchema = z.discriminatedUnion("template", [
  z.strictObject({ ...ogImageBase, template: z.literal("headline-cta"), data: headlineCtaDataSchema }),
  z.strictObject({ ...ogImageBase, template: z.literal("headline-chart"), data: headlineChartDataSchema }),
]);

const sfxShape = Object.fromEntries(SFX_EVENTS.map((event) => [event, relativePath.optional()])) as Record<SfxEvent, z.ZodOptional<typeof relativePath>>;

export const marketingSchema = z
  .strictObject({
    $schema: z.string().optional(),
    brand: brandSchema,
    app: appSchema,
    voice: voiceSchema,
    videos: z.array(videoSchema).min(1, "needs at least one video"),
    social: socialSchema.optional(),
    screenshots: z.array(screenshotSchema).default([]),
    ogImages: z.array(ogImageSchema).default([]),
    /** Sound effects of the composition; a missing one is silent. */
    sfx: z.strictObject(sfxShape).prefault({}),
    output: z
      .strictObject({
        /** Finished films and post copy (`<dir>/<video>/`); not committed. */
        dir: relativePath.default("marketing/out"),
        /** Recordings and compositions (`<buildDir>/<video>/`); not committed. */
        buildDir: relativePath.default("marketing/build"),
        quality: z.enum(QUALITIES).default("standard"),
      })
      .prefault({}),
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
    checkUnique("screenshots");
    checkUnique("ogImages");
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
  });

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
