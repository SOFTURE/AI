// The "use server" export rule of @softure-ai/testing/guards/next, run over every workspace package's own sources:
// Next.js refuses a `"use server"` module that exports anything but async functions, on any route that imports it.
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { findNonAsyncServerExports } from "@softure-ai/testing/guards/next";
import { describe, expect, it } from "vitest";

import { listRepoFiles, REPO_ROOT } from "./repo-files.js";

const PACKAGE_SOURCE = /^(foundation|modules|themes|tools)\/[^/]+\/src\/.+\.tsx?$/;
const NOT_SOURCE = /\.(test|d)\.tsx?$/;

describe("server actions of the packages", () => {
  it("export only async functions from a \"use server\" module", () => {
    const files = listRepoFiles()
      .filter((file) => PACKAGE_SOURCE.test(file) && !NOT_SOURCE.test(file))
      .map((file) => ({ file, source: readFileSync(join(REPO_ROOT, file), "utf8") }));

    expect(files.length).toBeGreaterThan(100);
    expect(findNonAsyncServerExports(files)).toEqual([]);
  });
});
