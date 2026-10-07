// The article's OG route over a published PGlite blog: it draws in `brand.fonts`, and a font file it
// cannot read fails the card with a message naming it. Next's request scope is replaced as in
// pages.test.tsx.
import { createRequire } from "node:module";
import type { SoftureConfig } from "@softure-ai/core";
import type { Queryable } from "@softure-ai/db";
import { BlogArticleOgImage } from "@softure-ai/blog/next";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { TestBlog } from "../support.js";
import { createPublishedBlog } from "./support.js";

const scope = vi.hoisted((): { config: SoftureConfig | undefined; db: Queryable | undefined } => ({ config: undefined, db: undefined }));

vi.mock("@softure-ai/core/next", () => ({
  getSoftureConfig: () => {
    if (scope.config === undefined) throw new Error("test: no config registered");
    return scope.config;
  },
}));
vi.mock("@softure-ai/db", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@softure-ai/db")>()),
  getConfiguredDatabase: () => Promise.resolve({ db: scope.db }),
}));
vi.mock("next/cache", () => ({ unstable_cache: <T,>(read: T) => read }));

const require = createRequire(import.meta.url);
const INTER_700 = require.resolve("@fontsource/inter/files/inter-latin-700-normal.woff");
const MISSING = `${INTER_700}.missing.woff`;

let test: TestBlog | undefined;

async function useBlog(fonts: readonly { name: string; weight: 700; src: string }[]): Promise<void> {
  test = await createPublishedBlog({ brand: { name: "Example", fonts: [...fonts] } });
  scope.config = test.config;
  scope.db = test.ctx.db;
}

afterEach(async () => {
  scope.config = undefined;
  scope.db = undefined;
  await test?.database.close();
  test = undefined;
});

const params = (slug: string) => ({ params: Promise.resolve({ slug }) });

describe("BlogArticleOgImage", () => {
  it("draws an article's card in the brand's fonts", async () => {
    await useBlog([{ name: "Inter", weight: 700, src: INTER_700 }]);
    const card = await BlogArticleOgImage(params("index-funds"));
    const png = new Uint8Array(await card.arrayBuffer());
    expect([...png.subarray(0, 4)]).toEqual([0x89, 0x50, 0x4e, 0x47]);
  });

  it("fails with a message naming a font file it cannot read", async () => {
    await useBlog([{ name: "Inter", weight: 700, src: MISSING }]);
    await expect(BlogArticleOgImage(params("index-funds"))).rejects.toThrow(
      `Blog OG card: brand.fonts[0] "${MISSING}": the file cannot be read (ENOENT) (${MISSING}).`,
    );
  });
});
