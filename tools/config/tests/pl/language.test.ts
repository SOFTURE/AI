import { describe, expect, it } from "vitest";
import { checkFiles, findPolishText, formatHits, getCommitMessageText, isExempt } from "../../src/language/index.js";

// This file lives in a folder named pl/, so the language gate exempts it: it has to spell Polish to test the gate.
describe("findPolishText", () => {
  it("reports a Polish diacritic in a code comment with its line number", () => {
    const text = "export const a = 1;\n// zmiana kwoty: będzie inaczej\n";
    expect(findPolishText("src/a.ts", text)).toEqual([{ line: 2, reason: 'Polish diacritic "ę"' }]);
  });

  it("reports an ASCII-only Polish sentence", () => {
    expect(findPolishText("src/a.ts", "// to nie dziala, trzeba poprawic\n")).toEqual([
      { line: 1, reason: 'Polish word "nie"' },
    ]);
  });

  it("reports Polish words in any letter case", () => {
    expect(findPolishText("README.md", "Jest OK.\n")).toEqual([{ line: 1, reason: 'Polish word "jest"' }]);
  });

  it("leaves English prose with short words such as ten, to and a alone", () => {
    const text = "The suggested ten items are kept, so it is up to a reviewer to merge them.\n";
    expect(findPolishText("docs/a.md", text)).toEqual([]);
  });

  it("ignores a FIRE_TRACKER slug quoted in a Markdown code span", () => {
    expect(findPolishText("docs/a.md", "Source: `src/app/nie-pamietam-hasla/` and `haslo`.\n")).toEqual([]);
  });

  it("reports the same words in Markdown outside a code span", () => {
    expect(findPolishText("docs/a.md", "Source: nie pamietam hasla.\n")).toEqual([
      { line: 1, reason: 'Polish word "nie"' },
    ]);
  });

  it("keeps checking backticks in code files, where they are template literals", () => {
    expect(findPolishText("src/a.ts", "const label = `nie wiem`;\n")).toEqual([
      { line: 1, reason: 'Polish word "nie"' },
    ]);
  });

  it("ignores a hyphenated slug and words glued to other characters", () => {
    const text = 'const route = "/app/nie-pamietam-hasla";\nconst hash = "sha512-ab+nie/cd=";\n';
    expect(findPolishText("src/a.ts", text)).toEqual([]);
  });

  it("treats an empty file as clean", () => {
    expect(findPolishText("src/a.ts", "")).toEqual([]);
  });

  it("skips a binary file", () => {
    expect(findPolishText("assets/a.png", "PNG\0\0nie jest")).toEqual([]);
  });
});

describe("isExempt", () => {
  it("exempts message dictionaries at any depth", () => {
    expect(isExempt("modules/auth/src/messages/pl.ts")).toBe(true);
    expect(isExempt("messages/pl.ts")).toBe(true);
  });

  it("exempts the gate's own word list and this test, which live in pl/ folders", () => {
    expect(isExempt("tools/config/src/language/pl/polish.ts")).toBe(true);
    expect(isExempt("tools/config/tests/pl/language.test.ts")).toBe(true);
  });

  it("exempts the lockfiles of npm, pnpm and yarn at any depth", () => {
    expect(isExempt("package-lock.json")).toBe(true);
    expect(isExempt("examples/app/pnpm-lock.yaml")).toBe(true);
    expect(isExempt("yarn.lock")).toBe(true);
    expect(isExempt("package.json")).toBe(false);
  });

  it("reads Windows separators", () => {
    expect(isExempt("src\\messages\\pl.ts")).toBe(true);
  });

  it("exempts Polish language data in a folder named pl", () => {
    expect(isExempt("modules/blog/src/quality/rulesets/pl/ruleset.ts")).toBe(true);
    expect(isExempt("modules/blog/tests/quality/fixtures/pl/model.md")).toBe(true);
  });

  it("does not exempt a file named pl or a folder that only starts with pl", () => {
    expect(isExempt("modules/blog/src/quality/pl.ts")).toBe(false);
    expect(isExempt("modules/blog/src/plan/notes.ts")).toBe(false);
    expect(isExempt("modules/blog/src/pl-helpers/notes.ts")).toBe(false);
  });

  it("does not exempt a file that merely mentions messages in its name", () => {
    expect(isExempt("src/messages-helper.ts")).toBe(false);
    expect(isExempt("modules/auth/src/server/login.ts")).toBe(false);
  });
});

describe("checkFiles", () => {
  it("names the file and line of every hit and skips exempt files", () => {
    const files: Record<string, string> = {
      "src/a.ts": "// ok\n// gdzie jest plik\n",
      "src/messages/pl.ts": 'export const pl = { title: "Gdzie jest plik" };\n',
    };
    expect(checkFiles(Object.keys(files), (path) => files[path] ?? null)).toEqual([
      { path: "src/a.ts", line: 2, reason: 'Polish word "gdzie"' },
    ]);
  });

  it("skips files that cannot be read (deleted or a folder)", () => {
    expect(checkFiles(["gone.ts"], () => null)).toEqual([]);
  });
});

describe("getCommitMessageText", () => {
  it("drops git's comment lines and the diff below the scissors line of git commit -v", () => {
    const raw = [
      "feat(x): add a title",
      "",
      "# Please enter the commit message for your changes.",
      "# ------------------------ >8 ------------------------",
      '+  title: "Gdzie jest plik",',
    ].join("\n");
    expect(getCommitMessageText(raw)).toBe("feat(x): add a title\n\n\n");
  });

  it("keeps a Polish message so the gate can reject it", () => {
    expect(findPolishText("COMMIT_EDITMSG", getCommitMessageText("docs: dodaj opis\n"))).toEqual([
      { line: 1, reason: 'Polish word "dodaj"' },
    ]);
  });
});

describe("formatHits", () => {
  it("prints one path:line: reason per hit, then the rule", () => {
    const output = formatHits([{ path: "src/a.ts", line: 2, reason: 'Polish word "gdzie"' }]);
    expect(output.split("\n")).toEqual([
      'src/a.ts:2: Polish word "gdzie"',
      "",
      expect.stringMatching(/^Language gate: 1 line\(s\) with Polish text\./),
    ]);
  });
});
