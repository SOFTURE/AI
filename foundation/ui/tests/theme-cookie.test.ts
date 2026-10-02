import { describe, expect, it } from "vitest";
import {
  applyThemeChoice,
  buildThemeCookie,
  DEFAULT_THEME_COOKIE,
  getThemeBootScript,
  parseThemeCookie,
} from "../src/index.js";

interface FakeMeta {
  media: string | null;
  content: string;
}

function createFakeDocument(cookie: string, metas: FakeMeta[] = []) {
  const attributes = new Map<string, string>();
  const listeners: (() => void)[] = [];
  const writes: string[] = [];
  return {
    attributes,
    writes,
    metas,
    fireLoaded: () => listeners.forEach((listener) => listener()),
    get cookie() {
      return cookie;
    },
    set cookie(value: string) {
      writes.push(value);
    },
    documentElement: {
      setAttribute: (name: string, value: string) => attributes.set(name, value),
      removeAttribute: (name: string) => attributes.delete(name),
    },
    addEventListener: (_type: string, listener: () => void) => listeners.push(listener),
    querySelectorAll: () =>
      metas.map((meta) => ({
        getAttribute: (name: string) => (name === "media" ? meta.media : null),
        setAttribute: (_name: string, value: string) => {
          meta.content = value;
        },
      })),
  };
}

type FakeDocument = ReturnType<typeof createFakeDocument>;

/** Compiles the boot script as text, the way the browser runs it. */
function compileScript(script: string): (doc: unknown) => void {
  // eslint-disable-next-line @typescript-eslint/no-implied-eval -- executing the inline script is the point of the test
  return new Function("document", script) as (doc: unknown) => void;
}

function runBootScript(doc: FakeDocument, script = getThemeBootScript()): void {
  compileScript(script)(doc);
}

describe("theme cookie", () => {
  it("reads no cookie, foreign cookies and an unknown value as system", () => {
    expect(parseThemeCookie(undefined)).toBe("system");
    expect(parseThemeCookie("")).toBe("system");
    expect(parseThemeCookie("session=abc; other=dark")).toBe("system");
    expect(parseThemeCookie(`${DEFAULT_THEME_COOKIE}=purple`)).toBe("system");
  });

  it("reads light and dark among other cookies, under a custom name too", () => {
    expect(parseThemeCookie("session=abc; sft-theme=light")).toBe("light");
    expect(parseThemeCookie("sft-theme=dark; session=abc")).toBe("dark");
    expect(parseThemeCookie("app-theme=dark", "app-theme")).toBe("dark");
  });

  it("deletes the cookie for system and keeps an explicit choice for a year", () => {
    expect(buildThemeCookie("system")).toBe("sft-theme=; Path=/; Max-Age=0; SameSite=Lax");
    expect(buildThemeCookie("dark")).toBe("sft-theme=dark; Path=/; Max-Age=31536000; SameSite=Lax");
  });

  it("adds the domain and the custom name", () => {
    expect(buildThemeCookie("light", { cookieName: "t", domain: "example.com" })).toBe(
      "t=light; Path=/; Domain=example.com; Max-Age=31536000; SameSite=Lax",
    );
  });

  it("round-trips every explicit choice", () => {
    for (const choice of ["light", "dark"] as const) {
      const [pair] = buildThemeCookie(choice).split(";");
      expect(parseThemeCookie(pair)).toBe(choice);
    }
  });
});

describe("boot script", () => {
  it("sets data-theme from the cookie and recolours the browser bar once the document is parsed", () => {
    const meta = { media: null, content: "#ffffff" };
    const doc = createFakeDocument("a=1; sft-theme=dark; b=2", [meta]);
    runBootScript(doc, getThemeBootScript({ themeColors: { light: "#eeeeee", dark: "#111111" } }));
    expect(doc.attributes.get("data-theme")).toBe("dark");
    doc.fireLoaded();
    expect(meta.content).toBe("#111111");
  });

  it("leaves the attribute alone without a valid cookie, so CSS follows the system", () => {
    for (const cookie of ["", "xsft-theme=dark", "sft-theme=green"]) {
      const doc = createFakeDocument(cookie);
      runBootScript(doc);
      expect(doc.attributes.has("data-theme")).toBe(false);
    }
  });

  it("honours a custom cookie name", () => {
    const doc = createFakeDocument("app-theme=light");
    runBootScript(doc, getThemeBootScript({ cookieName: "app-theme" }));
    expect(doc.attributes.get("data-theme")).toBe("light");
  });

  it("does not throw when cookies are blocked", () => {
    const blocked = {
      get cookie(): string {
        throw new Error("blocked");
      },
    };
    expect(() => compileScript(getThemeBootScript())(blocked)).not.toThrow();
  });

  it("rejects a bar colour that would break out of the script", () => {
    expect(() => getThemeBootScript({ themeColors: { light: "</script><script>alert(1)//", dark: "#000" } })).toThrow(
      /bar colour/,
    );
  });

  it("writes no raw angle bracket or slash into the script", () => {
    expect(getThemeBootScript({ themeColors: { light: "rgb(0 0 0 / 0.5)", dark: "#000" } })).not.toMatch(/"[^"]*\/[^"]*"/);
  });

  it("rejects a cookie name that would break out of the script", () => {
    expect(() => getThemeBootScript({ cookieName: 'x"]);alert(1)//' })).toThrow(/cookie name/);
  });
});

describe("applyThemeChoice", () => {
  it("writes the cookie, sets the attribute and recolours both bar metas", () => {
    const metas = [
      { media: "(prefers-color-scheme: light)", content: "" },
      { media: "(prefers-color-scheme: dark)", content: "" },
    ];
    const doc = createFakeDocument("", metas);
    applyThemeChoice("dark", { doc: doc as unknown as Document, themeColors: { light: "#eee", dark: "#111" } });
    expect(doc.writes).toEqual(["sft-theme=dark; Path=/; Max-Age=31536000; SameSite=Lax"]);
    expect(doc.attributes.get("data-theme")).toBe("dark");
    expect(metas.map((meta) => meta.content)).toEqual(["#111", "#111"]);
  });

  it("clears the attribute for system and gives each meta its own scheme colour", () => {
    const metas = [
      { media: "(prefers-color-scheme: light)", content: "" },
      { media: "(prefers-color-scheme: dark)", content: "" },
    ];
    const doc = createFakeDocument("sft-theme=dark", metas);
    doc.attributes.set("data-theme", "dark");
    applyThemeChoice("system", { doc: doc as unknown as Document, themeColors: { light: "#eee", dark: "#111" } });
    expect(doc.attributes.has("data-theme")).toBe(false);
    expect(doc.writes).toEqual(["sft-theme=; Path=/; Max-Age=0; SameSite=Lax"]);
    expect(metas.map((meta) => meta.content)).toEqual(["#eee", "#111"]);
  });

  it("deletes a host-only cookie before writing one for a domain", () => {
    const doc = createFakeDocument("");
    applyThemeChoice("light", { doc: doc as unknown as Document, domain: "example.com" });
    expect(doc.writes).toEqual([
      "sft-theme=; Path=/; Max-Age=0; SameSite=Lax",
      "sft-theme=light; Path=/; Domain=example.com; Max-Age=31536000; SameSite=Lax",
    ]);
  });
});
