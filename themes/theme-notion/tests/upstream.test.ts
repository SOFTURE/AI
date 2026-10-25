import { readdirSync, readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { UI_DELTAS } from "./upstream/deltas.js";
import { applyDeltas, findFirstDifference } from "./upstream/guard.js";

const UI_DIR = new URL("../src/ui/", import.meta.url);
const UPSTREAM_DIR = new URL("./upstream/", import.meta.url);

const UI_FILES = readdirSync(UI_DIR)
  .filter((name) => name.endsWith(".tsx"))
  .map((name) => name.replace(/\.tsx$/, ""))
  .sort();
const PINNED_FILES = readdirSync(UPSTREAM_DIR)
  .filter((name) => name.endsWith(".tsx.txt"))
  .map((name) => name.replace(/\.tsx\.txt$/, ""))
  .sort();

function readUi(file: string): string {
  return readFileSync(new URL(`${file}.tsx`, UI_DIR), "utf8");
}

function readUpstream(file: string): string {
  return readFileSync(new URL(`${file}.tsx.txt`, UPSTREAM_DIR), "utf8");
}

/** Null when the package file is the pinned upstream plus its listed deltas, else what differs. */
function checkFile(file: string, packageText: string): string | null {
  const applied = applyDeltas(readUpstream(file), UI_DELTAS[file] ?? []);
  if (!applied.ok) return applied.error;
  return findFirstDifference(applied.text, packageText);
}

// The four drifts of issue #735: the fixed text and the misplaced class string it carried in 0.2.0.
const DRIFTS_735 = [
  {
    file: "sidebar",
    fixed: '"flex h-full w-(--sidebar-width) flex-col bg-sidebar text-sidebar-foreground",\n          className\n        )}\n        {...props}\n      >\n        {children}\n      </div>\n    )\n  }\n\n  if (isMobile)',
    drifted: '"relative w-(--sidebar-width) bg-transparent transition-[width] duration-200 ease-linear",\n          className\n        )}\n        {...props}\n      >\n        {children}\n      </div>\n    )\n  }\n\n  if (isMobile)',
  },
  { file: "checkbox", fixed: '<CheckIcon className="size-3.5" />', drifted: '<CheckIcon className="grid place-content-center text-current transition-none" />' },
  { file: "select", fixed: '<ChevronUpIcon className="size-4" />', drifted: '<ChevronUpIcon className="flex cursor-default items-center justify-center py-1" />' },
  {
    file: "field",
    fixed: '"flex w-fit items-center gap-2 text-sm leading-snug font-medium group-data-[disabled=true]/field:opacity-50"',
    drifted: '"group/field-label peer/field-label flex w-fit gap-2 leading-snug group-data-[disabled=true]/field:opacity-50"',
  },
] as const;

describe("the shadcn new-york v4 upstream guard", () => {
  it("pins an upstream file for every ui component", () => {
    expect(PINNED_FILES).toEqual(expect.arrayContaining(UI_FILES));
    expect(Object.keys(UI_DELTAS).filter((file) => !UI_FILES.includes(file))).toEqual([]);
  });

  it.each(UI_FILES)("%s equals its pinned upstream with the listed deltas only", (file) => {
    expect(checkFile(file, readUi(file))).toBeNull();
  });

  it("gives every delta a reason", () => {
    const deltas = Object.entries(UI_DELTAS).flatMap(([file, list]) => list.map((delta) => [file, delta.reason.trim() !== ""]));
    expect(deltas.filter(([, hasReason]) => hasReason === false)).toEqual([]);
  });

  it.each(DRIFTS_735)("fails on the $file drift of issue #735", ({ file, fixed, drifted }) => {
    const source = readUi(file);
    expect(source.split(fixed)).toHaveLength(2);

    expect(checkFile(file, source.replace(fixed, () => drifted))).toMatch(/^line \d+:/);
  });
});

describe("applyDeltas", () => {
  it("replaces each upstream text once, in order", () => {
    expect(applyDeltas("a b c", [{ reason: "r", upstream: "b", ours: "B" }, { reason: "r", upstream: "B c", ours: "x" }])).toEqual({ ok: true, text: "a x" });
  });

  it("fails on an upstream text that is missing or not unique", () => {
    expect(applyDeltas("a a", [{ reason: "twice", upstream: "a", ours: "b" }])).toEqual({ ok: false, error: 'delta 0 (twice) matches 2 times, expected once: "a"' });
    expect(applyDeltas("a", [{ reason: "gone", upstream: "z", ours: "b" }])).toMatchObject({ ok: false });
  });

  it("keeps a $ in the replacement literal", () => {
    expect(applyDeltas("x", [{ reason: "r", upstream: "x", ours: "${a}$&" }])).toEqual({ ok: true, text: "${a}$&" });
  });
});

describe("findFirstDifference", () => {
  it("is null for equal texts and names the first differing line otherwise", () => {
    expect(findFirstDifference("a\nb", "a\nb")).toBeNull();
    expect(findFirstDifference("a\nb", "a")).toBe("line 2:\n  upstream + deltas: b\n  package:           (end of file)");
  });
});
