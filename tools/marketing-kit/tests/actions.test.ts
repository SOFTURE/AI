import { join } from "node:path";

import { describe, expect, it } from "vitest";

import type { LocatorDescriptor, SceneAction } from "../src/config/actions-schema.js";
import { loadMarketingConfig, type ActionBeat, type VideoConfig } from "../src/config/config.js";
import { createActionScene, getLocator, runAction } from "../src/record/actions.js";
import { ScreenGuardError } from "../src/record/record.js";
import { scene as fixtureScene } from "../examples/fixture/films/fixture-tour.js";
import { createTraceDirector, createTracePage, traceScene } from "./support/trace-director.js";

const describeLocator = (descriptor: LocatorDescriptor) => String(getLocator(createTracePage(), descriptor));

function getFixtureVideos(): VideoConfig[] {
  const loaded = loadMarketingConfig(join(import.meta.dirname, "..", "examples", "fixture", "marketing.json"));
  if (!loaded.ok) throw new Error(loaded.error);
  return loaded.config.videos;
}

async function runOne(action: SceneAction): Promise<unknown[]> {
  const { director, calls } = createTraceDirector();
  await runAction(director, action);
  return calls.map((call) => [call.method, ...call.args]);
}

describe("getLocator", () => {
  it("builds each descriptor kind with Playwright's matching builder", () => {
    expect(describeLocator({ kind: "role", role: "button", name: null, exact: false, nth: null })).toBe('getByRole("button")');
    expect(describeLocator({ kind: "role", role: "button", name: "Next", exact: true, nth: null })).toBe('getByRole("button", {name:"Next",exact:true})');
    expect(describeLocator({ kind: "text", text: "Your wealth", exact: false, nth: null })).toBe('getByText("Your wealth")');
    expect(describeLocator({ kind: "label", label: "Age", exact: true, nth: null })).toBe('getByLabel("Age", {exact:true})');
    expect(describeLocator({ kind: "testId", testId: "exit-date", nth: null })).toBe('getByTestId("exit-date")');
    expect(describeLocator({ kind: "css", css: "label", hasText: "intent", nth: null })).toBe('locator("label", {hasText:"intent"})');
    expect(describeLocator({ kind: "css", css: "#age", hasText: null, nth: null })).toBe('locator("#age")');
  });

  it("turns a regex match into a RegExp with its flags and applies nth", () => {
    expect(describeLocator({ kind: "role", role: "button", name: { regex: "^Next$", flags: "" }, exact: false, nth: null })).toBe("getByRole(\"button\", {name:/^Next$/})");
    expect(describeLocator({ kind: "text", text: { regex: "Step 2 of 7", flags: "i" }, exact: false, nth: 0 })).toBe("getByText(/Step 2 of 7/i).nth(0)");
    expect(describeLocator({ kind: "testId", testId: "row", nth: 3 })).toBe('getByTestId("row").nth(3)');
  });
});

describe("runAction", () => {
  it("calls the Director method of the same name, leaving out the options the action does not set", async () => {
    const css = (selector: string): LocatorDescriptor => ({ kind: "css", css: selector, hasText: null, nth: null });
    expect(await runOne({ do: "wide" })).toEqual([["wide"]]);
    expect(await runOne({ do: "wide", scale: 1.05, whoosh: true })).toEqual([["wide", { scale: 1.05, whoosh: true }]]);
    expect(await runOne({ do: "tap", target: css("#next") })).toEqual([["tap", 'locator("#next")']]);
    expect(await runOne({ do: "tap", target: css("#next"), after: 0.25 })).toEqual([["tap", 'locator("#next")', { after: 0.25 }]]);
    expect(await runOne({ do: "type", text: "36", perChar: 0.1 })).toEqual([["type", "36", { perChar: 0.1 }]]);
    expect(await runOne({ do: "press", key: "Enter" })).toEqual([["press", "Enter"]]);
    expect(await runOne({ do: "press", key: "Backspace", times: 2, perKey: 0.2 })).toEqual([["press", "Backspace", { times: 2, perKey: 0.2 }]]);
    expect(await runOne({ do: "fill", input: "age", value: "36" })).toEqual([["fill", "age", "36"]]);
    expect(await runOne({ do: "fill", input: "age", value: "36", clear: false })).toEqual([["fill", "age", "36", { clear: false }]]);
    expect(await runOne({ do: "blur" })).toEqual([["blur"]]);
    expect(await runOne({ do: "focus", target: [css("#a"), css("#b")], scale: 1.4, height: 230 })).toEqual([
      ["focus", ['locator("#a")', 'locator("#b")'], { scale: 1.4, height: 230 }],
    ]);
    expect(await runOne({ do: "bring", target: css("#a"), top: 90, seconds: 0.45 })).toEqual([["bring", 'locator("#a")', { top: 90, seconds: 0.45 }]]);
    expect(await runOne({ do: "mark", name: "exit-age", target: css("#a") })).toEqual([["mark", "exit-age", 'locator("#a")']]);
    expect(await runOne({ do: "still", name: "result" })).toEqual([["still", "result"]]);
    expect(await runOne({ do: "cue", name: "sparkle" })).toEqual([["cue", "sparkle"]]);
    expect(await runOne({ do: "hold", seconds: 1.1 })).toEqual([["hold", 1.1]]);
    expect(await runOne({ do: "until", word: "savings" })).toEqual([["until", "savings"]]);
    expect(await runOne({ do: "checkScreen" })).toEqual([["checkScreen"]]);
  });
});

describe("createActionScene", () => {
  const beats: ActionBeat[] = [
    { id: "age", index: 1, pad: null, actions: [{ do: "hold", seconds: 0.1 }, { do: "blur" }, { do: "checkScreen" }] },
    { id: "cta", index: 2, pad: 0, actions: [{ do: "wide" }] },
  ];

  it("plays each beat with its pad, in order", async () => {
    const calls = await traceScene(createActionScene(beats, 0));
    expect(calls.map((call) => [call.method, ...call.args])).toEqual([
      ["beat", "age"],
      ["hold", 0.1],
      ["blur"],
      ["checkScreen"],
      ["end", "age"],
      ["beat", "cta", { pad: 0 }],
      ["wide"],
      ["end", "cta"],
    ]);
  });

  it("names the JSON path of an action that fails, and keeps the cause", async () => {
    const { director } = createTraceDirector();
    const cause = new Error('locator("#next") did not appear within 5 s');
    director.blur = () => Promise.reject(cause);
    const error: unknown = await createActionScene(beats, 2)(director).catch((caught: unknown) => caught);
    expect(error).toBeInstanceOf(Error);
    expect((error as Error).message).toBe('videos[2].beats[1].actions[1] (blur): locator("#next") did not appear within 5 s');
    expect((error as Error).cause).toBe(cause);
  });

  it("keeps a screen guard failure a ScreenGuardError, so the CLI still exits with code 2", async () => {
    const { director } = createTraceDirector();
    director.checkScreen = () => Promise.reject(new ScreenGuardError('missing "49 years"'));
    const error: unknown = await createActionScene(beats, 0)(director).catch((caught: unknown) => caught);
    expect(error).toBeInstanceOf(ScreenGuardError);
    expect((error as Error).message).toBe('videos[0].beats[1].actions[2] (checkScreen): missing "49 years"');
  });

  it("makes the same Director calls for the fixture's JSON twin as its TS scene", async () => {
    const [moduleVideo, actionVideo] = getFixtureVideos();
    expect(moduleVideo?.sceneSource.kind).toBe("module");
    if (actionVideo?.sceneSource.kind !== "actions") throw new Error("the fixture's second video has no actions");
    expect(actionVideo.beats).toEqual(moduleVideo?.beats);
    const expected = await traceScene(fixtureScene);
    expect(expected).toHaveLength(18);
    expect(await traceScene(createActionScene(actionVideo.sceneSource.beats, actionVideo.index))).toEqual(expected);
  });
});
