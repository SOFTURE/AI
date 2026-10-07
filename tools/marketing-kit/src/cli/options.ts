import { COLOR_THEMES, type ColorTheme } from "../config/colors.js";
import { isCalendarDay } from "../config/day.js";
import { DEFAULT_CONFIG_FILE, QUALITIES, screenshotSchema, type MarketingJson, type Quality } from "../config/schema.js";

/**
 * `softure-marketing <command> <film> [flags]` (and `og [image]`, `shots [<id>]`): argument parsing, kept apart from
 * the commands so it is testable. A typo in a flag never passes silently: `--todya` would record the film from today
 * instead of from the given day.
 */

export const COMMANDS = ["all", "voice", "record", "render", "preview", "posts", "og", "shots"] as const;

export type Command = (typeof COMMANDS)[number];

const FILM_FLAGS = ["commit", "today", "url", "quality", "config"];
/** `shots` of the configured entries takes no film, so only the address and the config apply. */
const SHOTS_FLAGS = ["url", "config"];
/** `shots --page`: one page anywhere, its settings as flags; the same names as the entry's fields where they fit. */
const PAGE_FLAGS = ["page", "out", "expect", "width", "height", "scale", "full", "scroll", "wait", "motion", "scheme", "auth", "minbytes", "config"];
const KNOWN_FLAGS = [...new Set([...FILM_FLAGS, ...SHOTS_FLAGS, ...PAGE_FLAGS])];
/** The viewport of an ad-hoc shot without --width/--height: a common laptop screen (FIRE's screenshot script). */
export const PAGE_SHOT_VIEWPORT = { width: 1440, height: 900 } as const;
const FILM_ID = /^[a-z0-9]+(-[a-z0-9]+)*$/;

export interface FilmOptions {
  command: Exclude<Command, "og" | "shots">;
  /** The first film named; the only one for every command but `voice`. */
  filmId: string;
  /** Every film named, in order; `voice` takes several, the other commands one. */
  filmIds: string[];
  /** `voice` really pays for the voiceover only with `--commit`. */
  isCommit: boolean;
  /** The day the app counts from; overrides the video's `today` for one run. */
  today?: string;
  /** Another address of the recorded page. */
  url?: string;
  /** `--quality`; without it, `output.quality` from the config. */
  quality?: Quality;
  /** Path of the config file, relative to the current directory. */
  configPath: string;
}

/** `og [image]`: every `ogImages` entry, or the one named. */
export interface OgOptions {
  command: "og";
  imageId: string | null;
  configPath: string;
}

/** `shots [<id>]`: every `screenshots` entry, or the one named. */
export interface EntryShotsOptions {
  command: "shots";
  mode: "entries";
  /** One `screenshots` entry; without it, every entry. */
  shotId?: string;
  /** Another address of the app; each entry's path resolves against it. */
  url?: string;
  configPath: string;
}

/** `shots --page=<url> --out=<file> --expect=<phrase>`: one page anywhere, behind the same gates. */
export interface PageShotsOptions {
  command: "shots";
  mode: "page";
  /** The page itself, not a base address. */
  page: string;
  /** The PNG to write, relative to the current directory. */
  out: string;
  /** The shot's settings in the shape of a `screenshots` entry (`id` "page", `path` "/"; `storageState` as given). */
  entry: MarketingJson["screenshots"][number];
  /** `--scheme`; without it, `app.colorScheme`. */
  scheme?: ColorTheme;
  configPath: string;
}

export type ShotsOptions = EntryShotsOptions | PageShotsOptions;

export type CliOptions = FilmOptions | OgOptions | ShotsOptions;

export type ReadOptionsResult = { ok: true; options: CliOptions } | { ok: false; error: string };

export const USAGE = [
  `Usage: softure-marketing <command> <film> [--config=${DEFAULT_CONFIG_FILE}]`,
  "",
  "  all <film>                      voiceover from the cache -> recording -> render -> post copy",
  "  voice <film>... [--commit]      voiceovers in order; without --commit it only counts the characters",
  "  record <film> [--today=YYYY-MM-DD] [--url=...]   --today overrides the video's \"today\"",
  "  render <film> [--quality=draft|standard|high]",
  "  preview <film>                  open the composition in the hyperframes preview",
  "  posts <film>                    post copy for the configured platforms",
  "  og [image]                      OG images (PNG) of every ogImages entry, or of the one named",
  "  shots [<id>] [--url=...]        the screenshots entries (or one), each behind its quality gates",
  "  shots --page=<url> --out=<file.png> --expect=<phrase> [--width --height --scale --full --scroll --wait",
  "        --motion --scheme --auth --minbytes]   one page anywhere, behind the same gates; the app is not started",
].join("\n");

function isCommand(value: string | undefined): value is Command {
  return COMMANDS.some((command) => command === value);
}

function isQuality(value: string): value is Quality {
  return QUALITIES.some((quality) => quality === value);
}

export function readOptions(argv: string[]): ReadOptionsResult {
  const [command, ...rest] = argv;
  if (!isCommand(command)) {
    return { ok: false, error: `unknown command "${command ?? ""}".\n\n${USAGE}` };
  }
  const flags = new Map<string, string>();
  const positional: string[] = [];
  for (const arg of rest) {
    const match = /^--([a-z]+)(?:=(.*))?$/.exec(arg);
    const name = match?.[1];
    if (match === null || name === undefined) {
      positional.push(arg);
      continue;
    }
    if (!KNOWN_FLAGS.includes(name)) {
      const known = command === "shots" ? [...SHOTS_FLAGS, ...PAGE_FLAGS.filter((flag) => !SHOTS_FLAGS.includes(flag))] : FILM_FLAGS;
      return { ok: false, error: `unknown flag --${name}. Known: ${known.map((flag) => `--${flag}`).join(", ")}.` };
    }
    flags.set(name, match[2] ?? "true");
  }
  const configPath = flags.get("config") ?? DEFAULT_CONFIG_FILE;
  if (configPath === "true" || configPath.length === 0) return { ok: false, error: `--config needs a path, e.g. --config=${DEFAULT_CONFIG_FILE}.` };
  if (command === "og") return readOgOptions(positional, flags, configPath);
  if (command === "shots") return readShotsOptions(positional, flags, configPath);
  const notForFilms = [...flags.keys()].find((flag) => !FILM_FLAGS.includes(flag));
  if (notForFilms !== undefined) return { ok: false, error: `--${notForFilms} applies to shots only, not to ${command}.` };
  const filmId = positional[0];
  if (filmId === undefined) return { ok: false, error: `name the film, e.g. softure-marketing ${command} <film>.` };
  if (positional.length > 1 && command !== "voice") return { ok: false, error: `one film at a time, got ${positional.join(", ")}; only voice takes several.` };
  const badId = positional.find((id) => !FILM_ID.test(id));
  if (badId !== undefined) return { ok: false, error: `film name "${badId}": lowercase letters, digits and hyphens only.` };
  const repeated = positional.find((id, index) => positional.indexOf(id) !== index);
  if (repeated !== undefined) return { ok: false, error: `film "${repeated}" is named twice.` };
  const today = flags.get("today");
  if (today !== undefined && !isCalendarDay(today)) return { ok: false, error: `--today=${today}: expected a real day as YYYY-MM-DD.` };
  const quality = flags.get("quality");
  if (quality !== undefined && !isQuality(quality)) return { ok: false, error: `--quality=${quality}: expected ${QUALITIES.join(" | ")}.` };
  const commit = flags.get("commit");
  if (commit !== undefined && commit !== "true") return { ok: false, error: `--commit takes no value (got "${commit}").` };
  if (command === "all" && commit !== undefined) {
    return { ok: false, error: `"all" takes the voiceover from the cache only; to pay for one: softure-marketing voice ${filmId} --commit.` };
  }
  const url = flags.get("url");
  if (url === "true") return { ok: false, error: "--url needs an address, e.g. --url=http://localhost:3000/calculator." };
  return {
    ok: true,
    options: { command, filmId, filmIds: positional, isCommit: commit === "true", today, url, quality, configPath },
  };
}

function readOgOptions(positional: string[], flags: Map<string, string>, configPath: string): ReadOptionsResult {
  const extra = [...flags.keys()].filter((name) => name !== "config");
  if (extra.length > 0) return { ok: false, error: `og takes only --config, got ${extra.map((flag) => `--${flag}`).join(", ")}.` };
  if (positional.length > 1) return { ok: false, error: `one OG image at a time, got ${positional.join(", ")}; without a name, og renders them all.` };
  const imageId = positional[0] ?? null;
  if (imageId !== null && !FILM_ID.test(imageId)) return { ok: false, error: `OG image name "${imageId}": lowercase letters, digits and hyphens only.` };
  return { ok: true, options: { command: "og", imageId, configPath } };
}

/** `localhost:3000` parses as a URL with the scheme `localhost:`; only http(s) addresses reach an app. */
function isHttpAddress(value: string): boolean {
  return URL.canParse(value) && ["http:", "https:"].includes(new URL(value).protocol);
}

function readShotsOptions(positional: string[], flags: Map<string, string>, configPath: string): ReadOptionsResult {
  if (flags.has("page")) return readPageShotOptions(positional, flags, configPath);
  const unknown = [...flags.keys()].find((flag) => !SHOTS_FLAGS.includes(flag));
  if (unknown !== undefined) return { ok: false, error: `--${unknown} does not apply to shots. Known: ${SHOTS_FLAGS.map((flag) => `--${flag}`).join(", ")}.` };
  if (positional.length > 1) return { ok: false, error: `one screenshot at a time, got ${positional.join(", ")}; without an id, shots takes them all.` };
  const shotId = positional[0];
  if (shotId !== undefined && !FILM_ID.test(shotId)) return { ok: false, error: `screenshot id "${shotId}": lowercase letters, digits and hyphens only.` };
  const url = flags.get("url");
  if (url === "true") return { ok: false, error: "--url needs an address, e.g. --url=http://localhost:3000." };
  if (url !== undefined && !isHttpAddress(url)) return { ok: false, error: `--url=${url}: expected an address such as http://localhost:3000.` };
  return { ok: true, options: { command: "shots", mode: "entries", shotId, url, configPath } };
}

/** The flag each field of an ad-hoc shot comes from, so a schema issue names what the user typed. */
const PAGE_FIELD_FLAGS: Record<string, string> = {
  expect: "expect",
  width: "width",
  height: "height",
  scale: "scale",
  full: "full",
  scrollTo: "scroll",
  waitMs: "wait",
  motion: "motion",
  storageState: "auth",
  minBytes: "minbytes",
};

/** A number flag as written, or the text itself, so the schema reports it ("expected number, received string"). */
function readNumber(value: string | undefined): number | string | undefined {
  if (value === undefined) return undefined;
  const number = Number(value);
  return value.trim().length > 0 && Number.isFinite(number) ? number : value;
}

function readPageShotOptions(positional: string[], flags: Map<string, string>, configPath: string): ReadOptionsResult {
  const unknown = [...flags.keys()].find((flag) => !PAGE_FLAGS.includes(flag));
  if (unknown !== undefined) return { ok: false, error: `--${unknown} does not apply to shots --page. Known: ${PAGE_FLAGS.map((flag) => `--${flag}`).join(", ")}.` };
  if (positional.length > 0) return { ok: false, error: `shots --page takes no screenshot id, got ${positional.join(", ")}.` };
  const valued = [...flags.entries()].find(([name, value]) => name !== "full" && value === "true");
  if (valued !== undefined) return { ok: false, error: `--${valued[0]} needs a value, e.g. --${valued[0]}=<value>.` };
  const page = flags.get("page") ?? "";
  if (!isHttpAddress(page)) return { ok: false, error: `--page=${page}: expected the page's http(s) address, e.g. https://example.com/pricing.` };
  const out = flags.get("out");
  if (out === undefined || !out.toLowerCase().endsWith(".png")) return { ok: false, error: "shots --page needs --out=<file.png>, the screenshot to write." };
  if (!flags.has("expect")) return { ok: false, error: 'shots --page needs --expect=<phrase>: a phrase the page must show, so an error page is never kept as the screenshot.' };
  const full = flags.get("full");
  if (full !== undefined && full !== "true") return { ok: false, error: `--full takes no value (got "${full}").` };
  const scheme = flags.get("scheme");
  if (scheme !== undefined && !COLOR_THEMES.some((theme) => theme === scheme)) return { ok: false, error: `--scheme=${scheme}: expected ${COLOR_THEMES.join(" | ")}.` };
  const parsed = screenshotSchema.safeParse({
    id: "page",
    path: "/",
    expect: flags.get("expect"),
    width: readNumber(flags.get("width")) ?? PAGE_SHOT_VIEWPORT.width,
    height: readNumber(flags.get("height")) ?? PAGE_SHOT_VIEWPORT.height,
    scale: readNumber(flags.get("scale")),
    full: full === "true",
    scrollTo: readNumber(flags.get("scroll")),
    waitMs: readNumber(flags.get("wait")),
    motion: flags.get("motion"),
    storageState: flags.get("auth"),
    minBytes: readNumber(flags.get("minbytes")),
  });
  if (!parsed.success) {
    const [issue] = parsed.error.issues;
    const field = String(issue?.path[0] ?? "");
    return { ok: false, error: `--${PAGE_FIELD_FLAGS[field] ?? field}: ${issue?.message ?? "invalid"}.` };
  }
  return { ok: true, options: { command: "shots", mode: "page", page, out, entry: parsed.data, scheme: scheme as ColorTheme | undefined, configPath } };
}

/** The day a recording starts its page clock at, and where it came from. */
export type RecordingDay = { day: string; source: "--today" | "videos[].today" } | { day: null; source: "the day of the run" };

/** `--today` wins over the video's `today`; without either, the page clock starts now. */
export function getRecordingDay(flag: string | undefined, configured: string | null): RecordingDay {
  if (flag !== undefined) return { day: flag, source: "--today" };
  if (configured !== null) return { day: configured, source: "videos[].today" };
  return { day: null, source: "the day of the run" };
}
