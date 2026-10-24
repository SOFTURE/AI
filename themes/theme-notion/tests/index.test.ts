import { readdirSync } from "node:fs";

import { describe, expect, it } from "vitest";

import * as theme from "../src/index.js";

const UI_FILES = readdirSync(new URL("../src/ui/", import.meta.url))
  .filter((name) => name.endsWith(".tsx"))
  .map((name) => name.replace(/\.tsx$/, ""));

describe("@softure-ai/theme-notion", () => {
  it("exports no undefined value", () => {
    expect(Object.entries(theme).filter(([, value]) => value === undefined)).toEqual([]);
  });

  it("exports every shadcn component file, by its main component", async () => {
    expect(UI_FILES.length).toBe(36);
    for (const file of UI_FILES) {
      const module = (await import(`../src/ui/${file}.tsx`)) as Record<string, unknown>;
      const names = Object.keys(module);
      expect([file, names.length > 0]).toEqual([file, true]);
      for (const name of names) expect([file, name, name in theme]).toEqual([file, name, true]);
    }
  });
});
