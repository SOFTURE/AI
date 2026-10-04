import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { findMissingFiles, loadMarketingConfig, type MarketingConfig } from "../src/config/config.js";
import type { MarketingJsonInput } from "../src/config/schema.js";

const COLORS = {
  background: "#0c0c0d",
  foreground: "#f2f3f5",
  muted: "#a3a6ad",
  accent: "#cff26b",
  cta: "#2dd4bf",
  onCta: "#0c0c0d",
  captionBackground: "#ecf1f7",
  captionText: "#0c0c0d",
  captionHighlight: "#059669",
};

function makeConfig(): MarketingJsonInput {
  return {
    brand: { name: "Acme Plan", locale: "en-US", timezone: "Europe/London", colors: { ...COLORS } },
    app: { baseUrl: "http://localhost:3000", port: 3100, startCommand: ["npx", "next", "dev", "-p", "{port}"], device: { viewport: [390, 844], scale: 3 } },
    voice: { voiceId: "voice-1", language: "en" },
    videos: [
      {
        id: "anna-calculator",
        title: "Anna counts her date",
        path: "/calculator",
        persona: { name: "Anna", age: 36, tagline: "counts" },
        beats: [
          { id: "hook", text: "Forty-nine years. That is it." },
          { id: "scene", text: "Anna types." },
          { id: "cta", text: "Count yours." },
        ],
        hook: { still: "result", shots: [{ mark: "age", scale: 1.6 }, { mark: "date", scale: 1.3, word: "That" }] },
        screenGuard: ["49 years"],
        endCard: { headline: "Count", url: "example.com/calculator" },
        sceneModule: "scenes/anna-calculator.ts",
      },
    ],
  };
}

describe("loadMarketingConfig", () => {
  let dir: string;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "marketing-config-"));
    mkdirSync(join(dir, "marketing"));
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  function write(config: unknown): string {
    const file = join(dir, "marketing", "marketing.json");
    writeFileSync(file, JSON.stringify(config));
    return file;
  }

  function load(config: unknown): MarketingConfig {
    const result = loadMarketingConfig(write(config));
    if (!result.ok) throw new Error(result.error);
    return result.config;
  }

  function loadError(config: unknown): string {
    const result = loadMarketingConfig(write(config));
    if (result.ok) throw new Error("expected the config to be refused");
    return result.error;
  }

  it("resolves every path against the config file's folder, not the current directory", () => {
    const config = { ...makeConfig(), sfx: { tap: "sfx/tap.mp3" }, output: { dir: "../out" } };
    config.brand.logo = { svg: "brand/mark.svg" };
    const loaded = load(config);
    expect(loaded.root).toBe(join(dir, "marketing"));
    expect(loaded.brand.logo).toBe(join(dir, "marketing", "brand", "mark.svg"));
    expect(loaded.sfx).toEqual({ tap: join(dir, "marketing", "sfx", "tap.mp3") });
    expect(loaded.voice.cacheDir).toBe(join(dir, "marketing", "marketing", "voiceover"));
    expect(loaded.output).toEqual({ dir: join(dir, "out"), buildDir: join(dir, "marketing", "marketing", "build"), quality: "standard" });
    expect(loaded.videos[0]?.sceneSource).toEqual({ kind: "module", path: join(dir, "marketing", "scenes", "anna-calculator.ts") });
  });

  it("fills the defaults a project does not write", () => {
    const loaded = load(makeConfig());
    expect(loaded.app).toEqual({
      baseUrl: "http://localhost:3000",
      port: 3100,
      startCommand: ["npx", "next", "dev", "-p", "3100"],
      colorScheme: "light",
      hideSelectors: [],
      screenGuardSelector: "body",
    });
    expect(loaded.brand.language).toBe("en");
    expect(loaded.brand.fonts).toEqual({ heading: null, body: null });
    expect(loaded.social).toBeNull();
    expect(loaded.screenshots).toEqual([]);
    expect(loaded.ogImages).toEqual([]);
    expect(loaded.videos[0]?.endCard.note).toBe("");
  });

  it("builds each video's URLs, device and voice from the shared settings", () => {
    const video = load(makeConfig()).videos[0];
    expect(video?.url).toBe("http://localhost:3000/calculator");
    expect(video?.ownUrl).toBe("http://localhost:3100/calculator");
    expect(video?.format).toBe("9:16");
    expect(video?.device).toEqual({ viewport: { width: 390, height: 844 }, scale: 3, isMobile: true });
    expect(video?.voice).toEqual({ voiceId: "voice-1", modelId: "eleven_multilingual_v2", language: "en", tempo: 1 });
  });

  it("lets a video override the device and the voice", () => {
    const config = makeConfig();
    const [video] = config.videos;
    if (video === undefined) throw new Error("no video");
    video.device = { viewport: [412, 915], scale: 2.625, mobile: false };
    video.voice = { voiceId: "voice-2", tempo: 1.1 };
    const loaded = load(config).videos[0];
    expect(loaded?.device).toEqual({ viewport: { width: 412, height: 915 }, scale: 2.625, isMobile: false });
    expect(loaded?.voice).toEqual({ voiceId: "voice-2", modelId: "eleven_multilingual_v2", language: "en", tempo: 1.1 });
  });

  it("resolves each post's channels from the platforms, a video's own codes and the link-in-bio defaults", () => {
    const config = {
      ...makeConfig(),
      social: {
        linkTemplate: "https://example.com/calculator?z={code}",
        platforms: { tiktok: { code: "tt-01" }, instagram: { code: "ig-01" }, facebook: { code: "fb-01", linkInBio: true } },
        posts: [{ video: "anna-calculator", caption: "Caption", codes: { tiktok: "tt-anna" } }],
      },
    };
    const loaded = load(config);
    expect(loaded.social).toEqual({ linkTemplate: "https://example.com/calculator?z={code}" });
    expect(loaded.videos[0]?.post).toEqual({
      caption: "Caption",
      hashtags: [],
      channels: [
        { platform: "instagram", code: "ig-01", linkInBio: true },
        { platform: "facebook", code: "fb-01", linkInBio: true },
        { platform: "tiktok", code: "tt-anna", linkInBio: true },
      ],
    });
  });

  it("names the JSON path of a wrong type, an unknown key and a missing key, all at once", () => {
    const config = { ...makeConfig(), extra: true } as Record<string, unknown>;
    const app = config.app as Record<string, unknown>;
    app.port = "3100";
    const voice = config.voice as Record<string, unknown>;
    delete voice.voiceId;
    const error = loadError(config);
    expect(error).toContain(`${join(dir, "marketing", "marketing.json")} is not a valid marketing config:`);
    expect(error).toMatch(/^ {2}app\.port: /m);
    expect(error).toMatch(/^ {2}voice\.voiceId: /m);
    expect(error).toMatch(/^ {2}\(root\): Unrecognized key: "extra"/m);
  });

  it.each([
    ["a locale without a dictionary", (c: MarketingJsonInput) => (c.brand.locale = "de-DE"), "brand.locale: needs a language with message dictionaries: en, pl"],
    ["an unknown timezone", (c: MarketingJsonInput) => (c.brand.timezone = "Mars/Base"), "brand.timezone: must be an IANA timezone such as Europe/London"],
    ["an empty start command", (c: MarketingJsonInput) => (c.app.startCommand = []), "app.startCommand: "],
    ["a timezone given as an offset", (c: MarketingJsonInput) => (c.brand.timezone = "+01:00"), "brand.timezone: must be an IANA timezone such as Europe/London"],
    ["a timezone in the wrong case", (c: MarketingJsonInput) => (c.brand.timezone = "europe/london"), "brand.timezone: must be an IANA timezone such as Europe/London"],
    ["a selector that could end the style rule", (c: MarketingJsonInput) => (c.app.hideSelectors = ["a{}"]), "app.hideSelectors[0]: must be a CSS selector without { } ; < > \\ or /*"],
    ["a selector that opens a comment", (c: MarketingJsonInput) => (c.app.hideSelectors = ["a/*"]), "app.hideSelectors[0]: must be a CSS selector without { } ; < > \\ or /*"],
    ["a font file the browser cannot load", (c: MarketingJsonInput) => (c.brand.fonts = { body: { family: "Body", files: [{ path: "body.svg", weight: 400 }] } }), "brand.fonts.body.files[0].path: must be a .woff2, .woff, .ttf or .otf file"],
    ["a phone too tall for the frame", (c: MarketingJsonInput) => (c.app.device.viewport = [300, 900]), "app.device.viewport: is too tall for the 9:16 frame"],
    ["a tempo outside 0.8-1.3", (c: MarketingJsonInput) => (c.voice.tempo = 2), "voice.tempo: "],
    ["a film with two sentences", (c: MarketingJsonInput) => c.videos[0]?.beats.splice(1, 1), "videos[0].beats: a film needs at least three sentences: opening, scene, end card"],
    ["a repeated sentence id", (c: MarketingJsonInput) => c.videos[0]?.beats.push({ id: "scene", text: "Again." }), 'videos[0].beats[3].id: "scene" appears twice'],
    ["a sentence id that does not fit an HTML attribute", (c: MarketingJsonInput) => c.videos[0]?.beats.splice(1, 1, { id: "Bad id", text: "b" }), "videos[0].beats[1].id: must be lowercase letters"],
    ["an opening shot waiting for a word not in the first sentence", (c: MarketingJsonInput) => c.videos[0]?.hook.shots.push({ mark: "x", scale: 1, word: "Anna" }), 'videos[0].hook.shots[2].word: "Anna" is not a word of the first sentence'],
    ["an opening shot after the first without a word", (c: MarketingJsonInput) => c.videos[0]?.hook.shots.push({ mark: "x", scale: 1 }), "videos[0].hook.shots[2].word: every shot after the first needs the word of the first sentence it starts on"],
    ["an empty screen guard", (c: MarketingJsonInput) => c.videos[0]?.screenGuard.splice(0), "videos[0].screenGuard: the screen guard needs at least one phrase"],
    ["a blank screen guard phrase", (c: MarketingJsonInput) => c.videos[0]?.screenGuard.push("  "), "videos[0].screenGuard[1]: must not be blank"],
    ["an unknown format", (c: MarketingJsonInput) => Object.assign(c.videos[0] ?? {}, { format: "4:5" }), "videos[0].format: "],
  ])("refuses %s, naming its path", (_case, change, message) => {
    const config = makeConfig();
    change(config);
    expect(loadError(config)).toContain(`  ${message}`);
  });

  it("loads a one-shot opening without a word, since the first shot starts with the film", () => {
    const config = makeConfig();
    config.videos[0]?.hook.shots.splice(1);
    expect(load(config).videos[0]?.hook.shots).toEqual([{ mark: "age", scale: 1.6 }]);
  });

  it.each(["1:1", "16:9"] as const)("loads a %s video", (format) => {
    const config = makeConfig();
    Object.assign(config.videos[0] ?? {}, { format });
    expect(load(config).videos[0]?.format).toBe(format);
  });

  it("gives each video the layout override of its own format", () => {
    const config = makeConfig();
    const [video] = config.videos;
    if (video === undefined) throw new Error("no video");
    config.videos.push({ ...video, id: "anna-wide", format: "16:9" });
    const loaded = load({ ...config, layout: { "16:9": { caption: { fontSize: 44 }, endCard: { phone: { center: { x: 560 } } } } } });
    expect(loaded.videos.map((entry) => entry.layout)).toEqual([{}, { caption: { fontSize: 44 }, endCard: { phone: { center: { x: 560 } } } }]);
  });

  it("gives every video an empty layout override when there is no layout section", () => {
    expect(load(makeConfig()).videos[0]?.layout).toEqual({});
  });

  it.each([
    ["a caption below the frame", { "16:9": { caption: { top: 1081 } } }, "layout.16:9.caption.top: "],
    ["a key that is not overridable", { "9:16": { frame: { width: 720 } } }, 'layout.9:16: Unrecognized key: "frame"'],
    ["a format that does not exist", { "4:5": {} }, 'layout: Unrecognized key: "4:5"'],
    ["margins that leave the caption too narrow", { "9:16": { caption: { left: 900 } } }, "layout.9:16.caption: left and right margins leave 120 px for the text; at least 200"],
    ["an end-card phone scale out of range", { "1:1": { endCard: { phone: { scale: 3 } } } }, "layout.1:1.endCard.phone.scale: "],
  ])("refuses %s in layout, naming its path", (_case, layout, message) => {
    expect(loadError({ ...makeConfig(), layout })).toContain(`  ${message}`);
  });

  it("refuses two videos with one id", () => {
    const config = makeConfig();
    const [video] = config.videos;
    if (video === undefined) throw new Error("no video");
    config.videos.push({ ...video });
    expect(loadError(config)).toContain('  videos[1].id: "anna-calculator" appears twice');
  });

  it.each([
    ["a template without {code}", { linkTemplate: "https://example.com/" }, "social.linkTemplate: must contain {code}"],
    ["a relative template", { linkTemplate: "/calculator?z={code}" }, "social.linkTemplate: must be an absolute URL"],
    ["a code the channel reader would ignore", { platforms: { instagram: { code: "IG 01" } } }, "social.platforms.instagram.code: must be lowercase words"],
    ["an unknown platform", { platforms: { myspace: { code: "ms" } } }, 'social.platforms: Unrecognized key: "myspace"'],
    ["no platform", { platforms: {} }, "social.platforms: needs at least one platform"],
    ["a post for an unknown video", { posts: [{ video: "nope", caption: "" }] }, 'social.posts[0].video: no video "nope" in videos'],
    ["a post code for a platform not configured", { posts: [{ video: "anna-calculator", caption: "", codes: { tiktok: "tt" } }] }, 'social.posts[0].codes.tiktok: "tiktok" is not in social.platforms'],
  ])("refuses %s in social", (_case, change, message) => {
    const social = { linkTemplate: "https://example.com/calculator?z={code}", platforms: { instagram: { code: "ig-01" } }, posts: [], ...change };
    expect(loadError({ ...makeConfig(), social })).toContain(`  ${message}`);
  });

  it("takes screenshots and OG images as entries for their commands, with their defaults", () => {
    const loaded = load({
      ...makeConfig(),
      screenshots: [{ id: "landing", path: "/", width: 1440, height: 900, expect: "Count your date" }],
      ogImages: [{ id: "calculator", template: "headline-cta", data: { headline: "Count" } }],
    });
    expect(loaded.screenshots).toEqual([
      { id: "landing", path: "/", width: 1440, height: 900, full: false, expect: "Count your date", motion: "reduce", minBytes: 40_000, scale: 1 },
    ]);
    expect(loaded.ogImages).toEqual([{ id: "calculator", template: "headline-cta", size: [1200, 630], data: { headline: "Count", tiles: [] } }]);
  });

  const shot = { id: "hero", path: "/", width: 1440, height: 900, expect: "Count your date" };

  it("takes a screenshot's device scale and colour schemes as written", () => {
    const loaded = load({ ...makeConfig(), screenshots: [{ ...shot, scale: 2, colorSchemes: ["dark", "light"] }] });
    expect(loaded.screenshots[0]).toMatchObject({ scale: 2, colorSchemes: ["dark", "light"] });
  });

  it.each([
    ["a scale below 1", [{ ...shot, scale: 0.5 }], "screenshots[0].scale: Too small: expected number to be >=1"],
    ["a scale above 4", [{ ...shot, scale: 5 }], "screenshots[0].scale: Too big: expected number to be <=4"],
    ["an empty scheme list", [{ ...shot, colorSchemes: [] }], "screenshots[0].colorSchemes: Too small: expected array to have >=1 items"],
    ["a scheme listed twice", [{ ...shot, colorSchemes: ["dark", "dark"] }], "screenshots[0].colorSchemes: lists a scheme twice"],
    [
      "two entries writing one file",
      [
        { ...shot, colorSchemes: ["light", "dark"] },
        { ...shot, id: "hero-dark" },
      ],
      "screenshots[1].id: may write hero-dark.png, as screenshots[0] may (<id>.png, <id>-light.png, <id>-dark.png)",
    ],
    [
      "an id that is another entry's scheme file, even without scheme lists",
      [shot, { ...shot, id: "hero-light" }],
      "screenshots[1].id: may write hero-light.png, as screenshots[0] may (<id>.png, <id>-light.png, <id>-dark.png)",
    ],
  ])("refuses %s in screenshots, naming its path", (_case, screenshots, message) => {
    expect(loadError({ ...makeConfig(), screenshots })).toContain(`  ${message}`);
  });

  it("reports a missing file with its path", () => {
    const result = loadMarketingConfig(join(dir, "nope.json"));
    expect(!result.ok && result.error).toBe(`Reading the marketing config ${join(dir, "nope.json")}: ENOENT.`);
  });

  it("reports a file that is not JSON", () => {
    const file = join(dir, "broken.json");
    writeFileSync(file, "{");
    const result = loadMarketingConfig(file);
    expect(!result.ok && result.error).toMatch(/not JSON/);
  });
});

describe("findMissingFiles", () => {
  let dir: string;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "marketing-files-"));
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it("names every file a render reads that is not there by JSON path, and only the scene module otherwise", () => {
    const config = {
      ...makeConfig(),
      sfx: { tap: "sfx/tap.mp3" },
      brand: { ...makeConfig().brand, logo: { svg: "mark.svg" }, fonts: { body: { family: "Body", files: [{ path: "fonts/body.woff2", weight: 400 }] } } },
    };
    const file = join(dir, "marketing.json");
    writeFileSync(file, JSON.stringify(config));
    const loaded = loadMarketingConfig(file);
    if (!loaded.ok) throw new Error(loaded.error);
    const video = loaded.config.videos[0];
    if (video === undefined) throw new Error("no video");
    expect(findMissingFiles(loaded.config, video, true).map((issue) => issue.path.join("."))).toEqual([
      "videos.0.sceneModule",
      "brand.logo.svg",
      "brand.fonts.body.files.0.path",
      "sfx.tap",
    ]);
    writeFileSync(join(dir, "mark.svg"), "<svg/>");
    expect(findMissingFiles(loaded.config, video, true)).toHaveLength(3);
    expect(findMissingFiles(loaded.config, video, false).map((issue) => issue.path.join("."))).toEqual(["videos.0.sceneModule"]);
  });
});
