import { describe, expect, it } from "vitest";

import { findMalformedPlaceholder, findPlaceholders, resolvePlaceholders } from "../src/config/placeholders.js";
import { findCropFrame, findDimensionFailure } from "../src/screenshot/gates.js";
import { parsePrepareOutput, runPrepare } from "../src/screenshot/prepare.js";

describe("placeholders", () => {
  const sources = { env: { SHOTS_PASSWORD: "s3cret", EMPTY: "" }, data: { total: "12,345 USD", id: "a b/c" } };

  it("finds env and data placeholders, and nothing in plain text or other braces", () => {
    expect(findPlaceholders("{data:total} of {env:SHOTS_PASSWORD}")).toEqual([
      { kind: "data", key: "total" },
      { kind: "env", key: "SHOTS_PASSWORD" },
    ]);
    expect(findPlaceholders("Count {port} {persona}")).toEqual([]);
  });

  it("names a placeholder-like text with an unknown kind or a bad key, and passes the known ones", () => {
    expect(findMalformedPlaceholder("{dat:total}")).toBe("{dat:total}");
    expect(findMalformedPlaceholder("/a/{data:a-b}")).toBe("{data:a-b}");
    expect(findMalformedPlaceholder("{data:total} and {env:X} and {port}")).toBeNull();
  });

  it("replaces every placeholder, encoding only the inserted values", () => {
    expect(resolvePlaceholders("Total {data:total}", sources)).toEqual({ ok: true, value: "Total 12,345 USD" });
    expect(resolvePlaceholders("/accounts/{data:id}?x=1", sources, encodeURIComponent)).toEqual({ ok: true, value: "/accounts/a%20b%2Fc?x=1" });
    expect(resolvePlaceholders("{env:SHOTS_PASSWORD}", sources)).toEqual({ ok: true, value: "s3cret" });
  });

  it("refuses an unset or empty variable and a key the preparation did not print, without any value", () => {
    expect(resolvePlaceholders("{env:MISSING}", sources)).toEqual({ ok: false, error: "{env:MISSING} is not set in the environment" });
    expect(resolvePlaceholders("{env:EMPTY}", sources)).toEqual({ ok: false, error: "{env:EMPTY} is not set in the environment" });
    expect(resolvePlaceholders("{data:name}", sources)).toEqual({ ok: false, error: "{data:name} is not in what signIn.prepare printed (keys: total, id)" });
    expect(resolvePlaceholders("{data:name}", { env: {}, data: null })).toEqual({ ok: false, error: "{data:name} needs signIn.prepare, which did not run" });
  });
});

describe("signIn.prepare output", () => {
  it("reads the last non-empty line as the data, numbers as text", () => {
    expect(parsePrepareOutput('seeding…\n{"email":"demo@example.com","total":12345}\n\n')).toEqual({ ok: true, data: { email: "demo@example.com", total: "12345" } });
  });

  it.each([
    ["no output", "", "signIn.prepare printed nothing; "],
    ["a last line that is not JSON", '{"a":1}\ndone password=hunter2', "signIn.prepare's last line is not JSON; "],
    ["an array", "[1, 2]", "signIn.prepare's last line is not a JSON object; "],
    ["a nested value", '{"a":{"b":1}}', 'signIn.prepare\'s value "a" is not a string or a number; '],
  ])("refuses %s", (_case, stdout, start) => {
    const result = parsePrepareOutput(stdout);
    expect(result.ok).toBe(false);
    expect(!result.ok && result.error.startsWith(start)).toBe(true);
    expect(!result.ok && result.error).not.toContain("hunter2");
  });

  it("runs the command in the folder with the app's address, and reports a failing exit without its output", () => {
    const script = 'console.log("log line"); console.log(JSON.stringify({ base: process.env.MARKETING_BASE_URL, cwd: process.cwd() }))';
    expect(runPrepare(["node", "-e", script], { cwd: "/", baseUrl: "http://localhost:3199" })).toEqual({ ok: true, data: { base: "http://localhost:3199", cwd: "/" } });
    expect(runPrepare(["node", "-e", 'console.log("password=hunter2"); process.exit(3)'], { cwd: "/", baseUrl: "http://x" })).toEqual({
      ok: false,
      error: 'signIn.prepare (node -e console.log("password=hunter2"); process.exit(3)) ended with code 3',
    });
  });
});

describe("crop frame", () => {
  const page = { width: 1280, height: 2000 };

  it("is as wide as the element plus padding, from its top edge, at the aspect", () => {
    expect(findCropFrame({ element: { x: 16, y: 300.4, width: 358, height: 500 }, page, aspect: { width: 6, height: 5 }, padding: 0 })).toEqual({
      ok: true,
      frame: { x: 16, y: 300, width: 358, height: 298 },
    });
    expect(findCropFrame({ element: { x: 100, y: 100, width: 400, height: 50 }, page, aspect: { width: 4, height: 3 }, padding: 20 })).toEqual({
      ok: true,
      frame: { x: 80, y: 80, width: 440, height: 330 },
    });
  });

  it("refuses a frame past the page's bottom, left or top edge, or around an element without width", () => {
    expect(findCropFrame({ element: { x: 0, y: 1900, width: 400, height: 50 }, page, aspect: { width: 4, height: 3 }, padding: 0 })).toEqual({
      ok: false,
      message: "the 4:3 frame (400×300 px) runs 200 px past the page's bottom edge",
    });
    expect(findCropFrame({ element: { x: 10, y: 100, width: 400, height: 50 }, page, aspect: { width: 4, height: 3 }, padding: 20 })).toEqual({
      ok: false,
      message: "the 4:3 frame starts 10 px left of the page; lower crop.padding",
    });
    expect(findCropFrame({ element: { x: 100, y: 5, width: 400, height: 50 }, page, aspect: { width: 4, height: 3 }, padding: 20 })).toEqual({
      ok: false,
      message: "the 4:3 frame starts 15 px above the page; lower crop.padding",
    });
    expect(findCropFrame({ element: { x: 1000, y: 100, width: 400, height: 50 }, page, aspect: { width: 4, height: 3 }, padding: 0 })).toEqual({
      ok: false,
      message: "the 4:3 frame runs 120 px past the page's right edge; lower crop.padding",
    });
    expect(findCropFrame({ element: { x: 0, y: 0, width: 0, height: 0 }, page, aspect: { width: 4, height: 3 }, padding: 0 })).toEqual({
      ok: false,
      message: "the crop's element has no width, so a 4:3 frame has nothing to show",
    });
  });

  it("passes a file of the frame at the scale, one pixel off included, and refuses one two pixels off", () => {
    expect(findDimensionFailure({ width: 716, height: 596 }, { width: 358, height: 298 }, 2)).toBeNull();
    expect(findDimensionFailure({ width: 538, height: 447 }, { width: 358, height: 298 }, 1.5)).toBeNull();
    expect(findDimensionFailure({ width: 716, height: 598 }, { width: 358, height: 298 }, 2)).toBe("the file is 716×598 px, not the crop's 716×596 px; deleted");
  });
});
