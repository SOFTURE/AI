import { describe, expect, it } from "vitest";

import { getRecordingDay, readOptions } from "../src/cli/options.js";

describe("readOptions", () => {
  it("reads a command, a film and the defaults", () => {
    expect(readOptions(["render", "anna-calculator"])).toEqual({
      ok: true,
      options: {
        command: "render",
        filmId: "anna-calculator",
        filmIds: ["anna-calculator"],
        isCommit: false,
        isPlaceholder: false,
        today: undefined,
        url: undefined,
        quality: undefined,
        configPath: "marketing.json",
      },
    });
  });

  it("reads every flag", () => {
    const result = readOptions(["record", "a", "--today=2026-09-29", "--url=http://localhost:4000/x", "--config=video/marketing.json"]);
    expect(result.ok && result.options).toMatchObject({ today: "2026-09-29", url: "http://localhost:4000/x", configPath: "video/marketing.json" });
  });

  it("accepts the posts command", () => {
    expect(readOptions(["posts", "a"]).ok).toBe(true);
  });

  it("reads og without an image as every image", () => {
    expect(readOptions(["og"])).toEqual({ ok: true, options: { command: "og", imageId: null, configPath: "marketing.json" } });
  });

  it("reads og with one image and a config", () => {
    expect(readOptions(["og", "calculator", "--config=site/marketing.json"])).toEqual({
      ok: true,
      options: { command: "og", imageId: "calculator", configPath: "site/marketing.json" },
    });
  });

  it("takes several films for voice, in order", () => {
    expect(readOptions(["voice", "ola", "ania", "ewa", "--commit"])).toMatchObject({
      ok: true,
      options: { command: "voice", filmId: "ola", filmIds: ["ola", "ania", "ewa"], isCommit: true },
    });
  });

  it("accepts --commit on voice", () => {
    expect(readOptions(["voice", "a", "--commit"])).toMatchObject({ ok: true, options: { isCommit: true } });
  });

  it.each([
    ["an unknown command", ["film", "a"], /unknown command "film"/],
    ["no command", [], /unknown command ""/],
    ["an unknown flag (a typo must not pass silently)", ["record", "a", "--todya=2026-09-29"], /unknown flag --todya/],
    ["no film", ["render"], /name the film/],
    ["two films", ["render", "a", "b"], /one film at a time, got a, b; only voice takes several/],
    ["the same film twice for voice", ["voice", "a", "b", "a"], /film "a" is named twice/],
    ["a bad id among several", ["voice", "a", "B"], /film name "B": lowercase/],
    ["a film id with uppercase", ["render", "Anna"], /lowercase letters, digits and hyphens/],
    ["a malformed --today", ["record", "a", "--today=29.09.2026"], /expected a real day as YYYY-MM-DD/],
    ["a --today that is not a calendar day", ["record", "a", "--today=2026-02-30"], /--today=2026-02-30: expected a real day/],
    ["an unknown quality", ["render", "a", "--quality=ultra"], /expected draft \| standard \| high/],
    ["--commit with a value", ["voice", "a", "--commit=yes"], /takes no value/],
    ["--commit on all, which never pays", ["all", "a", "--commit"], /from the cache only/],
    ["--config without a path", ["render", "a", "--config"], /--config needs a path/],
    ["--url without an address", ["record", "a", "--url"], /--url needs an address/],
    ["two OG images", ["og", "a", "b"], /one OG image at a time/],
    ["an OG image id with uppercase", ["og", "Calculator"], /lowercase letters, digits and hyphens/],
    ["a film flag on og", ["og", "--quality=draft"], /og takes only --config, got --quality/],
    ["--config without a path on og", ["og", "--config"], /--config needs a path/],
  ])("refuses %s", (_case, argv, message) => {
    const result = readOptions(argv);
    expect(result.ok).toBe(false);
    expect(!result.ok && result.error).toMatch(message);
  });
});

describe("readOptions for shots", () => {
  it("takes every screenshot without an id", () => {
    expect(readOptions(["shots"])).toEqual({ ok: true, options: { command: "shots", mode: "entries", shotId: undefined, url: undefined, configPath: "marketing.json" } });
  });

  it("takes one screenshot, another address and another config", () => {
    expect(readOptions(["shots", "landing", "--url=http://localhost:4000", "--config=web/marketing.json"])).toEqual({
      ok: true,
      options: { command: "shots", mode: "entries", shotId: "landing", url: "http://localhost:4000", configPath: "web/marketing.json" },
    });
  });

  it.each([
    ["a film flag", ["shots", "--quality=draft"], /--quality does not apply to shots\. Known: --url, --config\./],
    ["--today", ["shots", "--today=2026-10-03"], /--today does not apply to shots/],
    ["an unknown flag", ["shots", "--ful"], /unknown flag --ful/],
    ["two ids", ["shots", "a", "b"], /one screenshot at a time, got a, b/],
    ["an id with uppercase", ["shots", "Landing"], /screenshot id "Landing": lowercase letters, digits and hyphens only/],
    ["--url without an address", ["shots", "--url"], /--url needs an address/],
    ["--url without a scheme", ["shots", "--url=localhost:3000"], /--url=localhost:3000: expected an address such as http:\/\/localhost:3000/],
    ["--url that is not an address", ["shots", "--url=not an address"], /--url=not an address: expected an address/],
    ["--config without a path", ["shots", "--config="], /--config needs a path/],
  ])("refuses %s", (_case, argv, message) => {
    const result = readOptions(argv);
    expect(result.ok).toBe(false);
    expect(!result.ok && result.error).toMatch(message);
  });
});

describe("getRecordingDay", () => {
  it("takes --today over the video's day", () => {
    expect(getRecordingDay("2026-11-02", "2026-10-06")).toEqual({ day: "2026-11-02", source: "--today" });
  });

  it("takes the video's day without --today", () => {
    expect(getRecordingDay(undefined, "2026-10-06")).toEqual({ day: "2026-10-06", source: "videos[].today" });
  });

  it("records as of the day of the run without either", () => {
    expect(getRecordingDay(undefined, null)).toEqual({ day: null, source: "the day of the run" });
  });
});

describe("readOptions for shots --page", () => {
  const page = ["shots", "--page=https://example.com/pricing", "--out=shots/pricing.png", "--expect=Pricing"];

  it("reads an ad-hoc shot with the schema's defaults and a laptop viewport", () => {
    expect(readOptions(page)).toEqual({
      ok: true,
      options: {
        command: "shots",
        mode: "page",
        page: "https://example.com/pricing",
        out: "shots/pricing.png",
        entry: { id: "page", path: "/", expect: "Pricing", width: 1440, height: 900, scale: 1, full: false, waitMs: 0, motion: "reduce", minBytes: 40_000 },
        scheme: undefined,
        configPath: "marketing.json",
      },
    });
  });

  it("reads every setting", () => {
    const result = readOptions([...page, "--width=390", "--height=844", "--scale=3", "--scroll=1200", "--wait=800", "--motion=no-preference", "--scheme=dark", "--auth=auth/state.json", "--minbytes=5000"]);
    expect(result.ok && result.options).toMatchObject({
      scheme: "dark",
      entry: { width: 390, height: 844, scale: 3, scrollTo: 1200, waitMs: 800, motion: "no-preference", storageState: "auth/state.json", minBytes: 5000 },
    });
  });

  it("reads --full without a value", () => {
    const result = readOptions([...page, "--full"]);
    expect(result.ok && result.options).toMatchObject({ entry: { full: true } });
  });

  it.each([
    ["no --out", ["shots", "--page=https://example.com/", "--expect=x"], /shots --page needs --out=<file\.png>/],
    ["an --out that is not a PNG", ["shots", "--page=https://example.com/", "--out=a.jpg", "--expect=x"], /needs --out=<file\.png>/],
    ["no --expect", ["shots", "--page=https://example.com/", "--out=a.png"], /shots --page needs --expect=<phrase>/],
    ["a page that is not http(s)", ["shots", "--page=file:///etc/hosts", "--out=a.png", "--expect=x"], /--page=file:\/\/\/etc\/hosts: expected the page's http\(s\) address/],
    ["a screenshot id", [...page, "landing"], /shots --page takes no screenshot id, got landing/],
    ["--url", [...page, "--url=http://localhost:3000"], /--url does not apply to shots --page/],
    ["a valueless --wait", [...page, "--wait"], /--wait needs a value/],
    ["a word as a number", [...page, "--width=wide"], /--width: Invalid input: expected number, received string/],
    ["a negative scroll", [...page, "--scroll=-5"], /--scroll: Too small: expected number to be >=0/],
    ["--scroll with --full", [...page, "--full", "--scroll=100"], /--scroll: is one viewport frame at a scroll position/],
    ["an unknown scheme", [...page, "--scheme=sepia"], /--scheme=sepia: expected light \| dark/],
    ["an unknown motion", [...page, "--motion=slow"], /--motion: /],
    ["a value for --full", [...page, "--full=yes"], /--full takes no value/],
    ["an unknown flag", [...page, "--przewin=100"], /unknown flag --przewin/],
  ])("refuses %s", (_case, argv, message) => {
    const result = readOptions(argv);
    expect(result.ok).toBe(false);
    expect(!result.ok && result.error).toMatch(message);
  });

  it("refuses a shots-only flag on a film command", () => {
    const result = readOptions(["record", "a", "--wait=100"]);
    expect(!result.ok && result.error).toBe("--wait applies to shots only, not to record.");
  });
});

describe("readOptions with --placeholder", () => {
  it.each(["all", "record", "render"])("reads it on %s", (command) => {
    const result = readOptions([command, "a", "--placeholder"]);
    expect(result.ok && result.options).toMatchObject({ command, isPlaceholder: true });
  });

  it.each([
    ["voice, which pays for the real one", ["voice", "a", "--placeholder"], "--placeholder applies to all, record, render: the commands that record or render a film, not voice."],
    ["posts", ["posts", "a", "--placeholder"], "--placeholder applies to all, record, render: the commands that record or render a film, not posts."],
    ["a value", ["all", "a", "--placeholder=yes"], '--placeholder takes no value (got "yes").'],
  ])("refuses it on %s", (_case, argv, message) => {
    const result = readOptions(argv);
    expect(!result.ok && result.error).toBe(message);
  });
});
