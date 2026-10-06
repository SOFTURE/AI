import { isCalendarDay } from "../config/day.js";
import { DEFAULT_CONFIG_FILE, QUALITIES, type Quality } from "../config/schema.js";

/**
 * `softure-marketing <command> <film> [flags]` (and `og [image]`, `shots [<id>]`): argument parsing, kept apart from
 * the commands so it is testable. A typo in a flag never passes silently: `--todya` would record the film from today
 * instead of from the given day.
 */

export const COMMANDS = ["all", "voice", "record", "render", "preview", "posts", "og", "shots"] as const;

export type Command = (typeof COMMANDS)[number];

const KNOWN_FLAGS = ["commit", "today", "url", "quality", "config"];
/** `shots` takes no film, so only the address and the config apply. */
const SHOTS_FLAGS = ["url", "config"];
const FILM_ID = /^[a-z0-9]+(-[a-z0-9]+)*$/;

export interface FilmOptions {
  command: Exclude<Command, "og" | "shots">;
  filmId: string;
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
export interface ShotsOptions {
  command: "shots";
  /** One `screenshots` entry; without it, every entry. */
  shotId?: string;
  /** Another address of the app; each entry's path resolves against it. */
  url?: string;
  configPath: string;
}

export type CliOptions = FilmOptions | OgOptions | ShotsOptions;

export type ReadOptionsResult = { ok: true; options: CliOptions } | { ok: false; error: string };

export const USAGE = [
  `Usage: softure-marketing <command> <film> [--config=${DEFAULT_CONFIG_FILE}]`,
  "",
  "  all <film>                      voiceover from the cache -> recording -> render -> post copy",
  "  voice <film> [--commit]         voiceover; without --commit it only counts the characters",
  "  record <film> [--today=YYYY-MM-DD] [--url=...]   --today overrides the video's \"today\"",
  "  render <film> [--quality=draft|standard|high]",
  "  preview <film>                  open the composition in the hyperframes preview",
  "  posts <film>                    post copy for the configured platforms",
  "  og [image]                      OG images (PNG) of every ogImages entry, or of the one named",
  "  shots [<id>] [--url=...]        the screenshots entries (or one), each behind its quality gates",
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
      return { ok: false, error: `unknown flag --${name}. Known: ${KNOWN_FLAGS.map((flag) => `--${flag}`).join(", ")}.` };
    }
    flags.set(name, match[2] ?? "true");
  }
  const configPath = flags.get("config") ?? DEFAULT_CONFIG_FILE;
  if (configPath === "true" || configPath.length === 0) return { ok: false, error: `--config needs a path, e.g. --config=${DEFAULT_CONFIG_FILE}.` };
  if (command === "og") return readOgOptions(positional, flags, configPath);
  if (command === "shots") return readShotsOptions(positional, flags, configPath);
  const filmId = positional[0];
  if (filmId === undefined) return { ok: false, error: `name the film, e.g. softure-marketing ${command} <film>.` };
  if (positional.length > 1) return { ok: false, error: `one film at a time, got ${positional.join(", ")}.` };
  if (!FILM_ID.test(filmId)) return { ok: false, error: `film name "${filmId}": lowercase letters, digits and hyphens only.` };
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
    options: { command, filmId, isCommit: commit === "true", today, url, quality, configPath },
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
  const unknown = [...flags.keys()].find((flag) => !SHOTS_FLAGS.includes(flag));
  if (unknown !== undefined) return { ok: false, error: `--${unknown} does not apply to shots. Known: ${SHOTS_FLAGS.map((flag) => `--${flag}`).join(", ")}.` };
  if (positional.length > 1) return { ok: false, error: `one screenshot at a time, got ${positional.join(", ")}; without an id, shots takes them all.` };
  const shotId = positional[0];
  if (shotId !== undefined && !FILM_ID.test(shotId)) return { ok: false, error: `screenshot id "${shotId}": lowercase letters, digits and hyphens only.` };
  const url = flags.get("url");
  if (url === "true") return { ok: false, error: "--url needs an address, e.g. --url=http://localhost:3000." };
  if (url !== undefined && !isHttpAddress(url)) return { ok: false, error: `--url=${url}: expected an address such as http://localhost:3000.` };
  return { ok: true, options: { command: "shots", shotId, url, configPath } };
}

/** The day a recording starts its page clock at, and where it came from. */
export type RecordingDay = { day: string; source: "--today" | "videos[].today" } | { day: null; source: "the day of the run" };

/** `--today` wins over the video's `today`; without either, the page clock starts now. */
export function getRecordingDay(flag: string | undefined, configured: string | null): RecordingDay {
  if (flag !== undefined) return { day: flag, source: "--today" };
  if (configured !== null) return { day: configured, source: "videos[].today" };
  return { day: null, source: "the day of the run" };
}
