import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import type { Director, Film } from "../src/film.js";
import { recordFilm, type RecordingLog } from "../src/record/record.js";
import { CHROMIUM_PATH, hasChromium } from "./chromium.js";

/**
 * The recorder against a real browser on a page with prefilled fields: what `fill` and `press` leave in a field, and
 * which keys and frames they log.
 */

const PAGE = `<!doctype html>
<html><body style="margin:0;font:16px sans-serif">
  <main>
    <input name="prefilled" type="number" value="45" style="display:block;width:300px;margin:40px 10px" />
    <input name="empty" inputmode="numeric" style="display:block;width:300px;margin:40px 10px" />
    <input name="stubborn" value="45" oninput="if (this.value === '') this.value = '0'" style="display:block;width:300px;margin:40px 10px" />
  </main>
</body></html>`;

let dir = "";
let url = "";

beforeAll(() => {
  dir = mkdtempSync(join(tmpdir(), "marketing-kit-record-"));
  const file = join(dir, "page.html");
  writeFileSync(file, PAGE);
  url = pathToFileURL(file).href;
});

afterAll(() => {
  rmSync(dir, { recursive: true, force: true });
});

function makeFilm(actions: (director: Director) => Promise<void>): Film {
  return {
    id: "record-test",
    title: "Record test",
    persona: { name: "Anna", age: 36, tagline: "counts" },
    path: "/",
    format: "9:16",
    layout: {},
    device: { kind: "phone", viewport: { width: 360, height: 400 }, scale: 1, isMobile: true },
    voice: { voiceId: "v", modelId: "m", language: "en", tempo: 1 },
    beats: [
      { id: "hook", text: "Opening." },
      { id: "scene", text: "Middle." },
    ],
    hook: { still: "result", shots: [], transition: "fade" },
    screenGuard: [],
    endCard: { headline: "Count", url: "example.com", note: "" },
    scene: async (d) => {
      // A beat as short as the actions: the voiceover lasts no time and the pad is zero.
      await d.beat("scene", () => actions(d), { pad: 0 });
      await d.checkScreen();
      await d.still("result");
    },
  };
}

/** Records the actions and returns the log with the value each named field holds at the end. */
async function record(actions: (director: Director) => Promise<void>): Promise<{ log: RecordingLog; values: Record<string, string> }> {
  const values: Record<string, string> = {};
  const outDir = mkdtempSync(join(dir, "run-"));
  const log = await recordFilm({
    film: makeFilm(async (d) => {
      await actions(d);
      for (const name of ["prefilled", "empty", "stubborn"]) values[name] = await d.page.locator(`input[name=${name}]`).inputValue();
    }),
    url,
    outDir,
    voices: [{ id: "scene", start: 0, end: 0, words: [] }],
    voiceoverKey: "test",
    filmPath: "record.test.ts",
    ...(CHROMIUM_PATH === undefined ? {} : { executablePath: CHROMIUM_PATH }),
    browser: { colorScheme: "light", locale: "en-US", timezone: "Europe/London", hideSelectors: [], screenGuardSelector: "body" },
  });
  return { log, values };
}

describe.skipIf(!hasChromium)("recordFilm with prefilled fields", () => {
  it("fill replaces a prefilled value: select all and Backspace, each logged as a key, then the typed value", async () => {
    const { log, values } = await record((d) => d.fill("prefilled", "50"));
    expect(values.prefilled).toBe("50");
    expect(log.keys).toHaveLength(4);
    expect(log.taps).toHaveLength(1);
  });

  it("fill with clear: false types after the old value, as 0.1.8 did", async () => {
    const { values } = await record((d) => d.fill("prefilled", "50", { clear: false }));
    expect(values.prefilled).toBe("4550");
  });

  it("fill on an empty field presses no extra key and records the same frames as a tap and typing", async () => {
    const filled = await record((d) => d.fill("empty", "36"));
    const typed = await record(async (d) => {
      await d.tap(d.page.locator("input[name=empty]"), { after: 0.2 });
      await d.type("36");
    });
    expect(filled.values.empty).toBe("36");
    expect(filled.log.keys).toEqual(typed.log.keys);
    expect(filled.log.taps).toEqual(typed.log.taps);
    expect(filled.log.frames).toBe(typed.log.frames);
  });

  it("press repeats a key, logging and holding each press", async () => {
    const { log, values } = await record(async (d) => {
      await d.tap(d.page.locator("input[name=prefilled]"), { after: 0 });
      await d.press("Backspace", { times: 2, perKey: 0.1 });
    });
    expect(values.prefilled).toBe("");
    // Three frames per press at 30 fps, counted from the first press.
    expect(log.keys.map((frame) => frame - (log.keys[0] ?? 0))).toEqual([0, 3]);
  });

  it("fill fails naming the field when the value does not go", async () => {
    await expect(record((d) => d.fill("stubborn", "50"))).rejects.toThrow(
      `sentence "scene": locator('input[name=stubborn]') still holds "0" after select all and Backspace`,
    );
  });
});
