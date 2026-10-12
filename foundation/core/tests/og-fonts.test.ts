// The OG card font loader: a source is read from a path or an https URL once and checked to be a font Satori reads.
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, relative } from "node:path";
import { createOgFontLoader, loadOgFonts, OG_FONT_WEIGHTS, type OgFontSource } from "@softure-ai/core/og";
import { afterEach, describe, expect, it } from "vitest";

const ROOT = "/app";
const TTF = new Uint8Array([0, 1, 0, 0, 7, 7, 7, 7]);
const OTF = new Uint8Array([0x4f, 0x54, 0x54, 0x4f, 7, 7]);
const WOFF = new Uint8Array([0x77, 0x4f, 0x46, 0x46, 7, 7]);
const WOFF2 = new Uint8Array([0x77, 0x4f, 0x46, 0x32, 0, 1, 0, 0]);

function source(src: string, overrides: Partial<OgFontSource> = {}): OgFontSource {
  return { name: "Inter", src, ...overrides };
}

function createReader(files: Readonly<Record<string, Uint8Array>>): { readFile: (path: string) => Promise<Uint8Array>; reads: string[] } {
  const reads: string[] = [];
  return {
    reads,
    readFile: (path) => {
      reads.push(path);
      const bytes = files[path];
      if (bytes === undefined) return Promise.reject(Object.assign(new Error("missing"), { code: "ENOENT" }));
      return Promise.resolve(bytes);
    },
  };
}

function createFetch(answers: Readonly<Record<string, () => Response>>): { fetchImpl: typeof fetch; calls: string[] } {
  const calls: string[] = [];
  const fetchImpl: typeof fetch = (input) => {
    const url = input instanceof Request ? input.url : String(input);
    calls.push(url);
    const answer = answers[url];
    if (answer === undefined) return Promise.reject(new TypeError("fetch failed"));
    return Promise.resolve(answer());
  };
  return { fetchImpl, calls };
}

describe("createOgFontLoader", () => {
  it("reads a relative path from the root once and gives the card its name, weight, style and bytes", async () => {
    const reader = createReader({ "/app/fonts/inter.ttf": TTF });
    const load = createOgFontLoader({ root: ROOT, readFile: reader.readFile });
    const fonts = [source("fonts/inter.ttf", { weight: 700, style: "italic" }), source("/app/fonts/inter.ttf", { name: "Inter Copy" })];
    const [first, second] = await Promise.all([load(fonts), load(fonts)]);
    expect(first).toEqual(second);
    expect(first.ok).toBe(true);
    if (!first.ok) return;
    expect(first.fonts.map(({ name, weight, style }) => ({ name, weight, style }))).toEqual([
      { name: "Inter", weight: 700, style: "italic" },
      { name: "Inter Copy", weight: undefined, style: undefined },
    ]);
    expect([...new Uint8Array(first.fonts[0]?.data ?? new ArrayBuffer(0))]).toEqual([...TTF]);
    expect(reader.reads).toEqual(["/app/fonts/inter.ttf"]);
  });

  it("accepts .ttf, .otf and .woff bytes", async () => {
    const reader = createReader({ "/app/a.ttf": TTF, "/app/b.otf": OTF, "/app/c.woff": WOFF });
    const load = createOgFontLoader({ root: ROOT, readFile: reader.readFile });
    const result = await load([source("a.ttf"), source("b.otf"), source("c.woff")]);
    expect(result.ok && result.fonts.length).toBe(3);
  });

  it("names the source and the reason under the default label, and reads a failed file again on the next card", async () => {
    const reader = createReader({});
    const load = createOgFontLoader({ root: ROOT, readFile: reader.readFile });
    const expected = { ok: false, error: 'OG card: fonts[0] "fonts/missing.woff": the file cannot be read (ENOENT) (/app/fonts/missing.woff).' };
    expect(await load([source("fonts/missing.woff")])).toEqual(expected);
    expect(await load([source("fonts/missing.woff")])).toEqual(expected);
    expect(reader.reads).toEqual(["/app/fonts/missing.woff", "/app/fonts/missing.woff"]);
  });

  it("uses the caller's label in the message", async () => {
    const reader = createReader({ "/app/a.ttf": TTF, "/app/b.woff2": WOFF2 });
    const load = createOgFontLoader({ root: ROOT, readFile: reader.readFile, label: "Landing OG card: fonts" });
    expect(await load([source("a.ttf"), source("b.woff2")])).toEqual({
      ok: false,
      error: 'Landing OG card: fonts[1] "b.woff2": a .woff2 font, which the card cannot read; use the .woff or .ttf file (/app/b.woff2).',
    });
  });

  it("fetches an https URL once, and names the status of a failed answer, the cause of a failed request and bytes that are no font", async () => {
    const font = "https://cdn.example.com/inter.woff";
    const gone = "https://cdn.example.com/gone.woff";
    const html = "https://cdn.example.com/page.ttf";
    const down = "https://down.example.com/inter.woff";
    const { fetchImpl, calls } = createFetch({
      [font]: () => new Response(WOFF),
      [gone]: () => new Response("Not found", { status: 404 }),
      [html]: () => new Response("<!doctype html>"),
    });
    const load = createOgFontLoader({ root: ROOT, fetchImpl });
    expect((await load([source(font)])).ok).toBe(true);
    expect((await load([source(font)])).ok).toBe(true);
    expect(calls).toEqual([font]);
    expect(await load([source(gone)])).toEqual({ ok: false, error: `OG card: fonts[0] "${gone}": the server answered 404 (${gone}).` });
    expect(await load([source(down)])).toEqual({ ok: false, error: `OG card: fonts[0] "${down}": the request failed (fetch failed) (${down}).` });
    expect(await load([source(html)])).toEqual({ ok: false, error: `OG card: fonts[0] "${html}": not a .ttf, .otf or .woff font (${html}).` });
  });
});

describe("loadOgFonts", () => {
  let folder: string | undefined;

  afterEach(async () => {
    if (folder !== undefined) await rm(folder, { recursive: true, force: true });
    folder = undefined;
  });

  it("reads a relative path from the working directory", async () => {
    folder = await mkdtemp(join(tmpdir(), "og-fonts-"));
    const file = join(folder, "inter.ttf");
    await writeFile(file, TTF);
    const result = await loadOgFonts([source(relative(process.cwd(), file), { weight: 400 })]);
    expect(result.ok && result.fonts.map((font) => font.weight)).toEqual([400]);
  });
});

describe("OG_FONT_WEIGHTS", () => {
  it("lists the static weights Satori draws", () => {
    expect(OG_FONT_WEIGHTS).toEqual([100, 200, 300, 400, 500, 600, 700, 800, 900]);
  });
});
