import { describe, expect, it } from "vitest";
import { findUndefinedTokenClasses } from "../src/testing/index.js";

const THEME = `@import "tailwindcss";
@theme {
  --color-brand: oklch(0.6 0.1 150);
  --color-surface-raised: var(--sft-color-surface-raised);
  --text-sm: 0.875rem;
  --ease-snappy: cubic-bezier(0.2, 0, 0, 1);
}
:root {
  --motion-fast: 120ms;
}`;

function check(source: string, options: { prefix?: string; allow?: readonly (string | RegExp)[]; css?: string | readonly string[] } = {}) {
  return findUndefinedTokenClasses({ css: options.css ?? THEME, sources: [{ file: "app/page.tsx", source }], ...options });
}

describe("findUndefinedTokenClasses", () => {
  it("passes colour utilities that name a defined token, with variants, important and opacity", () => {
    const source = `<div className="bg-brand hover:bg-brand/40 md:focus:!text-brand border-surface-raised fill-brand stroke-brand outline-brand border-t-brand bg-brand/(--alpha) -bg-brand bg-brand/[0.3]" />`;
    expect(check(source)).toEqual([]);
  });

  it("reports a colour utility whose token is not defined, as file:line: class", () => {
    const source = `const a = 1;\nconst classes = "bg-brand text-brnad";\nconst more = ["hover:border-nope/50"];`;
    expect(check(source)).toEqual(["app/page.tsx:2: text-brnad", "app/page.tsx:3: hover:border-nope/50"]);
  });

  it("passes the keyword and numeric utilities that share the colour prefixes", () => {
    const source = [
      "text-sm text-left text-center text-wrap text-balance text-ellipsis",
      "bg-cover bg-center bg-no-repeat bg-linear-to-r bg-radial bg-clip-text bg-none bg-transparent bg-current bg-inherit",
      "border border-2 border-t border-x-4 border-dashed border-none border-collapse border-spacing-2",
      "fill-none stroke-2 stroke-none outline outline-none outline-hidden outline-2 outline-offset-2 outline-dashed",
    ]
      .map((classes) => `"${classes}"`)
      .join("\n");
    expect(check(source)).toEqual([]);
  });

  it("skips arbitrary values: raw colours are findRawColors' job", () => {
    expect(check(`"bg-[var(--x)] text-[#000] border-[color:var(--y)] bg-[url(/a.png)]"`)).toEqual([]);
  });

  it("checks a variable reference against every variable the CSS declares", () => {
    const source = `"bg-(--color-brand) duration-(--motion-fast) text-(color:--motion-fast)"\n"bg-(--missing) ease-(--gone)"`;
    expect(check(source)).toEqual(["app/page.tsx:2: bg-(--missing)", "app/page.tsx:2: ease-(--gone)"]);
  });

  it("checks ease against --ease-* tokens and reports a named duration, which Tailwind 4 never compiles", () => {
    const source = `"ease-snappy ease-linear ease-initial duration-150 duration-0 duration-initial"\n"ease-bounce duration-fast"`;
    expect(check(source)).toEqual(["app/page.tsx:2: ease-bounce", "app/page.tsx:2: duration-fast"]);
  });

  it("reads only string literals: comments and identifiers are not classes", () => {
    const source = `// bg-nope in a comment\n/* text-nope */\nconst bgNope = 1;\nconst x = "bg-brand";`;
    expect(check(source)).toEqual([]);
  });

  it("reads template literals and skips a class glued to an interpolation", () => {
    const source = "const c = `bg-brand ${isOn ? \"text-nope\" : \"\"} text-${tone} border-${side}-nope\n  fill-gone`;";
    expect(check(source)).toEqual(["app/page.tsx:1: text-nope", "app/page.tsx:2: fill-gone"]);
  });

  it("with a prefix checks only the prefixed classes", () => {
    const source = `"sft:bg-brand sft:hover:text-nope bg-whatever"`;
    expect(check(source, { prefix: "sft" })).toEqual(["app/page.tsx:1: sft:hover:text-nope"]);
  });

  it("does not report classes the allow list names, as a string or a pattern", () => {
    const source = `<input data-testid="text-input" className="bg-legacy-1 bg-legacy-2" />`;
    expect(check(source, { allow: ["text-input", /^bg-legacy-/] })).toEqual([]);
  });

  it("reads theme variables from every CSS given, but only inside @theme for named utilities", () => {
    const source = `"bg-brand bg-extra text-motion-fast"`;
    expect(check(source, { css: [THEME, "@theme inline { --color-extra: red; }"] })).toEqual(["app/page.tsx:1: text-motion-fast"]);
  });

  it("returns an empty list for no sources and for sources without classes", () => {
    expect(findUndefinedTokenClasses({ css: THEME, sources: [] })).toEqual([]);
    expect(check("export const answer = 42;")).toEqual([]);
  });
});
