import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { readGitMergeParentLines, runCheckLanguage } from "../src/cli/check-language-command.js";

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

describe("runCheckLanguage during a merge", () => {
  let cwd = "";
  const listTrackedFiles = (): string[] => ["dirty.ts"];
  const OLD_LINE = POLISH_LINE.trimEnd();
  const NEW_LINE = `// ${String.fromCodePoint(0x119)}`;

  beforeEach(() => {
    cwd = mkdtempSync(join(tmpdir(), "softure-check-language-merge-"));
    writeFileSync(join(cwd, "dirty.ts"), `export const a = 1;\n${OLD_LINE}\n${NEW_LINE}\n`);
  });

  afterEach(() => rmSync(cwd, { recursive: true, force: true }));

  it("drops a hit whose line is in a parent and keeps a line new to every parent", () => {
    const readMergeParentLines = () => () => new Set([OLD_LINE]);
    const result = runCheckLanguage(["dirty.ts"], { cwd, listTrackedFiles, readMergeParentLines });
    expect(result.exitCode).toBe(1);
    expect(result.output.split("\n")[0]).toBe(`dirty.ts:3: Polish diacritic "${String.fromCodePoint(0x119)}"`);
    expect(result.output).not.toContain("dirty.ts:2:");
  });

  it("passes when every hit came from a parent", () => {
    const readMergeParentLines = () => () => new Set([OLD_LINE, NEW_LINE]);
    expect(runCheckLanguage(["dirty.ts"], { cwd, listTrackedFiles, readMergeParentLines })).toEqual({
      exitCode: 0,
      output: "",
    });
  });

  it("checks the file in full when the parents' lines are unknown or no merge is in progress", () => {
    expect(runCheckLanguage(["dirty.ts"], { cwd, listTrackedFiles, readMergeParentLines: () => () => null }).exitCode).toBe(1);
    const noMerge = runCheckLanguage(["dirty.ts"], { cwd, listTrackedFiles, readMergeParentLines: () => null });
    expect(noMerge.output).toContain("dirty.ts:2:");
  });

  it("keeps checking every line with --all", () => {
    const readMergeParentLines = () => () => new Set([OLD_LINE, NEW_LINE]);
    expect(runCheckLanguage(["--all"], { cwd, listTrackedFiles, readMergeParentLines }).exitCode).toBe(1);
  });
});

describe("readGitMergeParentLines", () => {
  let cwd = "";
  const git = (...args: string[]): string =>
    execFileSync("git", args, { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
  const MAIN_LINE = POLISH_LINE.trimEnd();
  const RESOLVED_LINE = `// ${String.fromCodePoint(0x119)}`;

  beforeEach(() => {
    cwd = mkdtempSync(join(tmpdir(), "softure-check-language-git-"));
    git("init", "--quiet", "--initial-branch=main");
    git("config", "user.email", "test@example.com");
    git("config", "user.name", "Test");
    git("config", "commit.gpgsign", "false");
    writeFileSync(join(cwd, "conflict.ts"), "export const value = 0;\n");
    git("add", ".");
    git("commit", "--quiet", "-m", "base");
    git("checkout", "--quiet", "-b", "feature");
    writeFileSync(join(cwd, "conflict.ts"), "export const value = 1;\n");
    git("commit", "--quiet", "-am", "feature");
    git("checkout", "--quiet", "main");
    writeFileSync(join(cwd, "conflict.ts"), "export const value = 2;\n");
    writeFileSync(join(cwd, "notes.md"), `# Notes\n\n${MAIN_LINE}\n`);
    git("add", ".");
    git("commit", "--quiet", "-m", "main");
    git("checkout", "--quiet", "feature");
  });

  afterEach(() => rmSync(cwd, { recursive: true, force: true }));

  it("returns null when no merge is in progress", () => {
    expect(readGitMergeParentLines(cwd)).toBeNull();
  });

  it("lets a merge with a conflict pass the main branch's lines and fail the lines written in the merge", () => {
    expect(() => git("merge", "--quiet", "main")).toThrow();
    writeFileSync(join(cwd, "conflict.ts"), `export const value = 3;\n${RESOLVED_LINE}\n`);
    git("add", ".");
    const environment = { cwd, listTrackedFiles: () => [], readMergeParentLines: readGitMergeParentLines };
    const result = runCheckLanguage(["conflict.ts", "notes.md"], environment);
    expect(result.exitCode).toBe(1);
    expect(result.output.split("\n")[0]).toBe(`conflict.ts:2: Polish diacritic "${String.fromCodePoint(0x119)}"`);
    expect(result.output).not.toContain("notes.md");
    expect(readGitMergeParentLines(cwd)?.("missing.ts")).toEqual(new Set());
  });
});
