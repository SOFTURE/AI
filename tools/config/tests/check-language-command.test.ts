import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { runCheckLanguage } from "../src/cli/check-language-command.js";

// Polish samples are built from code points, so this file stays outside a pl/ folder.
const POLISH_LINE = `// ${String.fromCodePoint(0x105)}\n`;

describe("runCheckLanguage", () => {
  let cwd = "";
  const listTrackedFiles = (): string[] => ["clean.ts", "dirty.ts"];

  beforeEach(() => {
    cwd = mkdtempSync(join(tmpdir(), "softure-check-language-"));
    writeFileSync(join(cwd, "clean.ts"), "export const ok = 1;\n");
    writeFileSync(join(cwd, "dirty.ts"), `export const a = 1;\n${POLISH_LINE}`);
  });

  afterEach(() => rmSync(cwd, { recursive: true, force: true }));

  it("passes clean files given as arguments", () => {
    expect(runCheckLanguage(["clean.ts"], { cwd, listTrackedFiles })).toEqual({ exitCode: 0, output: "" });
  });

  it("passes when no file is given, as a hook with nothing staged", () => {
    expect(runCheckLanguage([], { cwd, listTrackedFiles })).toEqual({ exitCode: 0, output: "" });
  });

  it("fails with exit code 1 and names the file and line of a hit", () => {
    const result = runCheckLanguage(["clean.ts", "dirty.ts"], { cwd, listTrackedFiles });
    expect(result.exitCode).toBe(1);
    expect(result.output.split("\n")[0]).toBe(`dirty.ts:2: Polish diacritic "${String.fromCodePoint(0x105)}"`);
  });

  it("checks every tracked file with --all", () => {
    const result = runCheckLanguage(["--all"], { cwd, listTrackedFiles });
    expect(result.exitCode).toBe(1);
    expect(result.output).toContain("dirty.ts:2:");
  });

  it("skips a file that does not exist, as a staged deletion", () => {
    expect(runCheckLanguage(["gone.ts"], { cwd, listTrackedFiles }).exitCode).toBe(0);
  });

  it("checks only the message part of a commit message file", () => {
    writeFileSync(join(cwd, "COMMIT_EDITMSG"), `feat: add a title\n#${POLISH_LINE}`);
    expect(runCheckLanguage(["--commit-msg", "COMMIT_EDITMSG"], { cwd, listTrackedFiles }).exitCode).toBe(0);
    writeFileSync(join(cwd, "COMMIT_EDITMSG"), `feat: add a title\n${POLISH_LINE}`);
    expect(runCheckLanguage(["--commit-msg", "COMMIT_EDITMSG"], { cwd, listTrackedFiles }).exitCode).toBe(1);
  });

  it("refuses --commit-msg without a file and an unknown option with exit code 2", () => {
    expect(runCheckLanguage(["--commit-msg"], { cwd, listTrackedFiles })).toEqual({
      exitCode: 2,
      output: "--commit-msg needs the message file. Usage: softure-check-language <file>... | --all | --commit-msg <file>",
    });
    expect(runCheckLanguage(["--staged"], { cwd, listTrackedFiles }).exitCode).toBe(2);
  });
});
