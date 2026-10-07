import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import type { Page } from "playwright";
import { afterEach, beforeEach, describe, expect, expectTypeOf, it } from "vitest";

import { ACTION_NAMES, ARIA_ROLES, actionSchema, type ActionName, type AriaRole, type SceneActionInput } from "../src/config/actions-schema.js";
import { loadMarketingConfig, type MarketingConfig } from "../src/config/config.js";
import { getMarketingJsonSchema, type MarketingJsonInput } from "../src/config/schema.js";

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

type BeatInput = MarketingJsonInput["videos"][number]["beats"][number];

const SCENE: SceneActionInput[] = [
  { do: "fill", input: "age", value: "36" },
  { do: "until", word: "taps" },
  { do: "tap", target: { role: "button", name: { regex: "^Next$" } } },
  { do: "mark", name: "age", target: { css: "#age" } },
  { do: "mark", name: "date", target: [{ text: "Exit date", exact: true }, { testId: "exit-date" }] },
  { do: "checkScreen" },
  { do: "still", name: "result" },
];

function makeConfig(beats?: BeatInput[]): MarketingJsonInput {
  return {
    brand: { name: "Acme Plan", locale: "en-US", timezone: "Europe/London", colors: { ...COLORS } },
    app: { baseUrl: "http://localhost:3000", port: 3100, startCommand: ["npx", "next", "dev"], device: { viewport: [390, 844], scale: 3 } },
    voice: { voiceId: "voice-1", language: "en" },
    videos: [
      {
        id: "anna-calculator",
        title: "Anna counts her date",
        path: "/calculator",
        persona: { name: "Anna", age: 36, tagline: "counts" },
        beats: beats ?? [
          { id: "hook", text: "Forty-nine years. That is it." },
          { id: "scene", text: "Anna types her age and taps next.", actions: SCENE },
          { id: "cta", text: "Count yours.", pad: 1.2, actions: [{ do: "wide" }] },
        ],
        hook: { still: "result", shots: [{ mark: "age", scale: 1.6 }, { mark: "date", scale: 1.3, word: "That" }] },
        screenGuard: ["49 years"],
        endCard: { headline: "Count", url: "example.com/calculator" },
      },
    ],
  };
}

/** The config with the scene sentence's actions replaced. */
function withSceneActions(actions: unknown[]): unknown {
  const config = makeConfig();
  const scene = config.videos[0]?.beats[1];
  if (scene === undefined) throw new Error("no scene beat");
  return { ...config, videos: [{ ...config.videos[0], beats: [config.videos[0]?.beats[0], { ...scene, actions: [...SCENE, ...actions] }, config.videos[0]?.beats[2]] }] };
}

describe("beat actions in marketing.json", () => {
  let dir: string;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "marketing-actions-"));
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  function write(config: unknown): string {
    const file = join(dir, "marketing.json");
    writeFileSync(file, JSON.stringify(config));
    return file;
  }

  function load(config: unknown): MarketingConfig {
    const result = loadMarketingConfig(write(config));
    if (!result.ok) throw new Error(result.error);
    return result.config;
  }

  /** The error lines without the header, e.g. `videos[0].beats[1].actions[7].do: …`. */
  function loadErrors(config: unknown): string[] {
    const result = loadMarketingConfig(write(config));
    if (result.ok) throw new Error("expected the config to be refused");
    return result.error.split("\n").slice(1).map((line) => line.trim());
  }

  it("loads a video without sceneModule as an action scene with its pads and descriptors", () => {
    const video = load(makeConfig()).videos[0];
    expect(video?.beats).toEqual([
      { id: "hook", text: "Forty-nine years. That is it." },
      { id: "scene", text: "Anna types her age and taps next." },
      { id: "cta", text: "Count yours." },
    ]);
    expect(video?.sceneSource).toEqual({
      kind: "actions",
      beats: [
        {
          id: "scene",
          index: 1,
          pad: null,
          actions: [
            { do: "fill", input: "age", value: "36" },
            { do: "until", word: "taps" },
            { do: "tap", target: { kind: "role", role: "button", name: { regex: "^Next$", flags: "" }, exact: false, nth: null } },
            { do: "mark", name: "age", target: { kind: "css", css: "#age", hasText: null, nth: null } },
            {
              do: "mark",
              name: "date",
              target: [
                { kind: "text", text: "Exit date", exact: true, nth: null },
                { kind: "testId", testId: "exit-date", nth: null },
              ],
            },
            { do: "checkScreen" },
            { do: "still", name: "result" },
          ],
        },
        { id: "cta", index: 2, pad: 1.2, actions: [{ do: "wide" }] },
      ],
    });
  });

  it("accepts every action with only its required arguments", () => {
    const actions: SceneActionInput[] = [
      { do: "wide" },
      { do: "tap", target: { label: "Age" } },
      { do: "type", text: "36" },
      { do: "fill", input: "return_rate-2", value: "" },
      { do: "blur" },
      { do: "focus", target: { css: "label", hasText: { regex: "intent", flags: "i" }, nth: 2 } },
      { do: "bring", target: { text: { regex: "Step \\d of 7", flags: "iu" } } },
      { do: "mark", name: "x", target: { role: "heading" } },
      { do: "still", name: "y" },
      { do: "cue", name: "sparkle" },
      { do: "hold", seconds: 0 },
      { do: "until", word: "Anna" },
      { do: "checkScreen" },
    ];
    expect(actions.map((action) => action.do).sort()).toEqual([...ACTION_NAMES].sort());
    expect(load(withSceneActions(actions)).videos).toHaveLength(1);
  });

  it("names the allowed actions for an unknown one and the key for an unknown argument", () => {
    expect(loadErrors(withSceneActions([{ do: "click", target: { css: "a" } }, { do: "wide", zoom: 2 }]))).toEqual([
      "videos[0].beats[1].actions[7].do: Invalid discriminator value. Expected 'wide' | 'tap' | 'type' | 'fill' | 'blur' | 'focus' | 'bring' | 'mark' | 'still' | 'cue' | 'hold' | 'until' | 'checkScreen'",
      'videos[0].beats[1].actions[8]: Unrecognized key: "zoom"',
    ]);
  });

  it("names the key of a broken descriptor, alone or inside a target array, and the types a union takes", () => {
    expect(
      loadErrors(
        withSceneActions([
          { do: "focus", target: { txt: "Age" } },
          { do: "focus", target: [{ css: "#a" }, { role: "buton" }] },
          { do: "tap", target: { text: "Age", css: "#age" } },
          { do: "tap", target: { text: { regex: "Age", flag: "i" } } },
          { do: "tap", target: { role: "button", name: 5 } },
        ]),
      ),
    ).toEqual([
      'videos[0].beats[1].actions[7].target: Unrecognized key: "txt"',
      "videos[0].beats[1].actions[7].target: needs exactly one of role, text, label, testId, css (found none)",
      "videos[0].beats[1].actions[8].target[1].role: must be an ARIA role Playwright knows, such as button, heading, link or textbox",
      "videos[0].beats[1].actions[9].target: needs exactly one of role, text, label, testId, css (found text, css)",
      'videos[0].beats[1].actions[10].target.text: Unrecognized key: "flag"',
      "videos[0].beats[1].actions[11].target.name: must be string or object",
    ]);
  });

  it("refuses options that do not go with the descriptor's kind", () => {
    expect(
      loadErrors(
        withSceneActions([
          { do: "tap", target: { text: "Age", name: "x" } },
          { do: "tap", target: { role: "button", hasText: "x" } },
          { do: "tap", target: { text: { regex: "Age" }, exact: true } },
          { do: "tap", target: { testId: "age", exact: true } },
          { do: "tap", target: { css: "#a", nth: -1 } },
        ]),
      ),
    ).toEqual([
      "videos[0].beats[1].actions[7].target.name: goes only with role",
      "videos[0].beats[1].actions[8].target.hasText: goes only with css",
      "videos[0].beats[1].actions[9].target.exact: goes only with a string name, text or label",
      "videos[0].beats[1].actions[10].target.exact: goes only with a string name, text or label",
      "videos[0].beats[1].actions[11].target.nth: Too small: expected number to be >=0",
    ]);
  });

  it("refuses a regex that does not compile, unknown flags, an input that is not a name and an empty target array", () => {
    expect(
      loadErrors(
        withSceneActions([
          { do: "tap", target: { text: { regex: "(Age" } } },
          { do: "tap", target: { text: { regex: "Age", flags: "gi" } } },
          { do: "tap", target: { text: { regex: "Age", flags: "ii" } } },
          { do: "fill", input: "age]", value: "36" },
          { do: "mark", name: "m", target: [] },
          { do: "hold", seconds: 45 },
        ]),
      ),
    ).toEqual([
      "videos[0].beats[1].actions[7].target.text.regex: is not a valid regular expression",
      "videos[0].beats[1].actions[8].target.text.flags: must be any of i, m, s, u, each at most once",
      "videos[0].beats[1].actions[9].target.text.flags: must be any of i, m, s, u, each at most once",
      "videos[0].beats[1].actions[10].input: must be an input name such as age or returnRate",
      "videos[0].beats[1].actions[11].target: needs at least one locator",
      "videos[0].beats[1].actions[12].seconds: Too big: expected number to be <=30",
    ]);
  });

  it("refuses an until word the sentence does not say, with the sentence's punctuation ignored", () => {
    expect(loadErrors(withSceneActions([{ do: "until", word: "next" }, { do: "until", word: "Count" }]))).toEqual([
      'videos[0].beats[1].actions[8].word: "Count" is not a word of this sentence (Anna types her age and taps next)',
    ]);
  });

  it("checks the opening still, the opening marks and the screen guard against the actions", () => {
    const beats: BeatInput[] = [
      { id: "hook", text: "Forty-nine years. That is it." },
      { id: "scene", text: "Anna types.", actions: [{ do: "mark", name: "age", target: { css: "#age" } }] },
      { id: "cta", text: "Count yours.", actions: [] },
    ];
    expect(loadErrors(makeConfig(beats))).toEqual([
      'videos[0].hook.still: no "still" action saves "result"',
      'videos[0].hook.shots[1].mark: no "mark" action saves "date"',
      'videos[0].beats: needs a "checkScreen" action: the screen guard must run before the film can say what the screen shows',
    ]);
  });

  it("refuses actions on the opening sentence and a scene sentence without actions", () => {
    const config = makeConfig();
    const [hook, scene] = config.videos[0]?.beats ?? [];
    const beats = [{ ...hook, pad: 1, actions: [{ do: "wide" }] }, scene, { id: "cta", text: "Count yours." }];
    expect(loadErrors({ ...config, videos: [{ ...config.videos[0], beats }] })).toEqual([
      "videos[0].beats[0].actions: the opening sentence plays over the still; the scene starts at the second sentence",
      "videos[0].beats[0].pad: the opening sentence plays over the still; the scene starts at the second sentence",
      "videos[0].beats[2].actions: is required when the video has no sceneModule",
    ]);
  });

  it("refuses actions and pads next to a sceneModule", () => {
    const config = makeConfig();
    expect(loadErrors({ ...config, videos: [{ ...config.videos[0], sceneModule: "scene.ts" }] })).toEqual([
      "videos[0].beats[1].actions: the video has a sceneModule; use one or the other",
      "videos[0].beats[2].actions: the video has a sceneModule; use one or the other",
      "videos[0].beats[2].pad: the video has a sceneModule; use one or the other",
    ]);
  });

  it("takes a focus or mark target as one descriptor or as an array of them", () => {
    type Node = { properties?: Record<string, Node>; items?: Node; oneOf?: Node[]; anyOf?: Node[]; const?: string; type?: string };
    const schema = getMarketingJsonSchema() as Node;
    const actions = schema.properties?.videos?.items?.properties?.beats?.items?.properties?.actions?.items;
    for (const name of ["focus", "mark"]) {
      const target = actions?.oneOf?.find((option) => option.properties?.do?.const === name)?.properties?.target;
      expect(target?.anyOf?.map((form) => form.type)).toEqual(["object", "array"]);
    }
    for (const target of [{ css: "#a" }, [{ css: "#a" }, { text: "b" }]]) {
      expect(actionSchema.safeParse({ do: "focus", target }).success).toBe(true);
      expect(actionSchema.safeParse({ do: "mark", name: "m", target }).success).toBe(true);
    }
    expect(actionSchema.safeParse({ do: "tap", target: [{ css: "#a" }] }).success).toBe(false);
  });

  describe("a sentence's own screen guard", () => {
    /** The config with phrases on the scene sentence and the video's list replaced. */
    function withSentencePhrases(sentencePhrases: unknown, videoPhrases?: string[]): unknown {
      const config = makeConfig();
      const [hook, scene, cta] = config.videos[0]?.beats ?? [];
      const video = { ...config.videos[0], beats: [hook, { ...scene, screenGuard: sentencePhrases }, cta], screenGuard: videoPhrases };
      return { ...config, videos: [video] };
    }

    it("loads the phrases onto their sentence and leaves the others without", () => {
      const video = load(withSentencePhrases(["age 36"], ["49 years"])).videos[0];
      expect(video?.beats).toEqual([
        { id: "hook", text: "Forty-nine years. That is it." },
        { id: "scene", text: "Anna types her age and taps next.", screenGuard: ["age 36"] },
        { id: "cta", text: "Count yours." },
      ]);
      expect(video?.screenGuard).toEqual(["49 years"]);
    });

    it("loads a film whose phrases all live on its sentences, with no video list and no checkScreen", () => {
      const config = withSentencePhrases(["age 36"]) as MarketingJsonInput;
      const scene = config.videos[0]?.beats[1];
      if (scene === undefined) throw new Error("no scene beat");
      scene.actions = SCENE.filter((action) => action.do !== "checkScreen");
      expect(load(config).videos[0]?.screenGuard).toEqual([]);
    });

    it("refuses a film with no phrase anywhere", () => {
      expect(loadErrors(withSentencePhrases(undefined, []))).toEqual([
        "videos[0].screenGuard: the screen guard needs at least one phrase, here or in a sentence's screenGuard",
      ]);
    });

    it("refuses an empty list and a blank phrase on a sentence", () => {
      expect(loadErrors(withSentencePhrases([]))).toEqual([
        "videos[0].beats[1].screenGuard: a sentence's screen guard needs at least one phrase; leave it out instead",
      ]);
      expect(loadErrors(withSentencePhrases(["age 36", " "]))).toEqual(["videos[0].beats[1].screenGuard[1]: must not be blank"]);
    });

    it("refuses phrases on the opening sentence, with actions or with a sceneModule", () => {
      const config = makeConfig();
      const [hook, scene, cta] = config.videos[0]?.beats ?? [];
      const beats = [{ ...hook, screenGuard: ["49 years"] }, scene, cta];
      const message = "videos[0].beats[0].screenGuard: the opening sentence plays over the still; the scene starts at the second sentence";
      expect(loadErrors({ ...config, videos: [{ ...config.videos[0], beats }] })).toEqual([message]);
      const moduleBeats = beats.map((beat) => ({ id: beat?.id, text: beat?.text, screenGuard: ["49 years"] }));
      expect(loadErrors({ ...config, videos: [{ ...config.videos[0], beats: moduleBeats, sceneModule: "scene.ts" }] })).toEqual([message]);
    });
  });

  it("lists exactly the roles Playwright's getByRole takes and exactly the Director's actions", () => {
    expectTypeOf<AriaRole>().toEqualTypeOf<Parameters<Page["getByRole"]>[0]>();
    expectTypeOf<ActionName>().toEqualTypeOf<SceneActionInput["do"]>();
    expect(new Set(ARIA_ROLES).size).toBe(ARIA_ROLES.length);
  });
});
