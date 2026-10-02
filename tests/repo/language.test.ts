import { describe, expect, it } from "vitest";
import { checkFiles, findPolishText, isExempt } from "../../scripts/check-language.mjs";
import { listRepoFiles, REPO_ROOT } from "./repo-files.js";

// This file is exempt from the language gate by path: it has to spell Polish to test the gate.
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

  it("exempts the gate itself and its test, which must spell the words", () => {
    expect(isExempt("scripts/check-language.mjs")).toBe(true);
    expect(isExempt("tests/repo/language.test.ts")).toBe(true);
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

describe("the repository", () => {
  it("has no Polish text in any file outside message dictionaries", () => {
    expect(checkFiles(listRepoFiles(), undefined, REPO_ROOT)).toEqual([]);
  });
});
