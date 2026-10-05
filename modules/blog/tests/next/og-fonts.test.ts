// The OG card's brand fonts: read from a path or an https URL once, checked to be a font Satori reads.
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { createOgFontLoader, type OgFontSource } from "@softure-ai/blog/next";
import { describe, expect, it } from "vitest";

const require = createRequire(import.meta.url);
/** Inter's latin subset from the `@fontsource/inter` dev dependency (OFL-1.1). */
const INTER_400 = require.resolve("@fontsource/inter/files/inter-latin-400-normal.woff");
const ROOT = dirname(dirname(INTER_400));
const RELATIVE = "files/inter-latin-400-normal.woff";

function source(src: string, overrides: Partial<OgFontSource> = {}): OgFontSource {
  return { name: "Inter", weight: 400, style: "normal", src, ...overrides };
}

function createCountingReader(): { readFile: (path: string) => Promise<Uint8Array>; reads: string[] } {
  const reads: string[] = [];
  return {
    reads,
    readFile: async (path) => {
      reads.push(path);
      return readFile(path);
    },
  };
}

function createFetch(answers: Readonly<Record<string, Response | (() => Response)>>): { fetchImpl: typeof fetch; calls: string[] } {
  const calls: string[] = [];
  const fetchImpl: typeof fetch = (input) => {
    const url = input instanceof Request ? input.url : String(input);
    calls.push(url);
    const answer = answers[url];
    if (answer === undefined) return Promise.reject(new TypeError("fetch failed"));
    return Promise.resolve(typeof answer === "function" ? answer() : answer);
  };
  return { fetchImpl, calls };
}

describe("createOgFontLoader", () => {
  it("reads a path from the app root and gives the card its name, weight, style and bytes", async () => {
    const reader = createCountingReader();
    const load = createOgFontLoader({ root: ROOT, readFile: reader.readFile });
    const result = await load([source(RELATIVE, { weight: 700 })]);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.fonts.map(({ name, weight, style }) => ({ name, weight, style }))).toEqual([{ name: "Inter", weight: 700, style: "normal" }]);
    expect(Buffer.from(result.fonts[0]?.data ?? new ArrayBuffer(0)).equals(await readFile(INTER_400))).toBe(true);
    expect(reader.reads).toEqual([INTER_400]);
  });

  it("reads each file once, also for two cards at the same time and for an absolute path to the same file", async () => {
    const reader = createCountingReader();
    const load = createOgFontLoader({ root: ROOT, readFile: reader.readFile });
    const fonts = [source(RELATIVE), source(INTER_400, { name: "Inter Copy" })];
    const [first, second] = await Promise.all([load(fonts), load(fonts)]);
    const third = await load(fonts);
    expect([first.ok, second.ok, third.ok]).toEqual([true, true, true]);
    expect(reader.reads).toEqual([INTER_400]);
  });

  it("names the option, the source and the reason of a missing file, and reads it again on the next card", async () => {
    const reader = createCountingReader();
    const load = createOgFontLoader({ root: ROOT, readFile: reader.readFile });
    const fonts = [source(RELATIVE), source("fonts/missing.woff", { weight: 700 })];
    const missing = join(ROOT, "fonts/missing.woff");
    expect(await load(fonts)).toEqual({
      ok: false,
      error: `Blog OG card: brand.fonts[1] "fonts/missing.woff": the file cannot be read (ENOENT) (${missing}).`,
    });
    expect((await load(fonts)).ok).toBe(false);
    expect(reader.reads).toEqual([INTER_400, missing, missing]);
  });

  it("fetches an https URL once", async () => {
    const url = "https://cdn.example.com/inter-400.woff";
    const bytes = await readFile(INTER_400);
    const { fetchImpl, calls } = createFetch({ [url]: () => new Response(bytes) });
    const load = createOgFontLoader({ root: ROOT, fetchImpl });
    expect((await load([source(url)])).ok).toBe(true);
    expect((await load([source(url)])).ok).toBe(true);
    expect(calls).toEqual([url]);
  });

  it("names the URL and the status of a failed answer, and the cause of a failed request", async () => {
    const url = "https://cdn.example.com/gone.woff";
    const down = "https://down.example.com/inter.woff";
    const { fetchImpl } = createFetch({ [url]: () => new Response("Not found", { status: 404 }) });
    const load = createOgFontLoader({ root: ROOT, fetchImpl });
    expect(await load([source(url)])).toEqual({ ok: false, error: `Blog OG card: brand.fonts[0] "${url}": the server answered 404 (${url}).` });
    expect(await load([source(down)])).toEqual({ ok: false, error: `Blog OG card: brand.fonts[0] "${down}": the request failed (fetch failed) (${down}).` });
  });

  it("refuses bytes that are not a .ttf, .otf or .woff font", async () => {
    const html = "https://cdn.example.com/inter.ttf";
    const woff2 = "https://cdn.example.com/inter-renamed.woff";
    const { fetchImpl } = createFetch({
      [html]: () => new Response("<!doctype html><title>Not found</title>"),
      [woff2]: () => new Response(new Uint8Array([0x77, 0x4f, 0x46, 0x32, 0, 1, 0, 0])),
    });
    const load = createOgFontLoader({ root: ROOT, fetchImpl });
    expect(await load([source(html)])).toEqual({
      ok: false,
      error: `Blog OG card: brand.fonts[0] "${html}": not a .ttf, .otf or .woff font (${html}).`,
    });
    expect(await load([source(woff2)])).toEqual({
      ok: false,
      error: `Blog OG card: brand.fonts[0] "${woff2}": a .woff2 font, which the card cannot read; use the .woff or .ttf file (${woff2}).`,
    });
  });
});
