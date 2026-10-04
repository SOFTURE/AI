// The module definition: its manifest, its options and its health check.
import { readFileSync } from "node:fs";
import { toModuleJson } from "@softure-ai/core";
import { blog } from "@softure-ai/blog";
import { checkArticlesTable, getBlogOptions } from "@softure-ai/blog/server";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import { createConfig, createTestBlog } from "./support.js";

describe("the blog module", () => {
  it("ships a module.json equal to its manifest", () => {
    const moduleJson: unknown = JSON.parse(readFileSync(new URL("../module.json", import.meta.url), "utf8"));
    expect(moduleJson).toEqual(toModuleJson(blog));
  });

  it("keeps the package version and the manifest version in step", () => {
    const manifest = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8")) as { version: string };
    expect(blog.manifest.version).toBe(manifest.version);
  });

  it("fills in the defaults: content/blog, no reserved slugs, no app fields", () => {
    expect(blog().options).toEqual({ contentDir: "content/blog", reservedSlugs: [] });
  });

  it("takes the app's folder, reserved slugs and fields schema", () => {
    const fields = z.object({ scenario: z.string().optional() });
    const options = blog({ contentDir: "posts", reservedSlugs: ["glossary"], fields }).options;
    expect(options).toEqual({ contentDir: "posts", reservedSlugs: ["glossary"], fields });
    expect(getBlogOptions(createConfig({ contentDir: "posts" })).contentDir).toBe("posts");
  });

  it("refuses options it cannot use, listing every problem", () => {
    expect(() =>
      blog({
        contentDir: " ",
        reservedSlugs: ["Glossary"],
        // @ts-expect-error: a plain object is not a schema.
        fields: { scenario: "string" },
      }),
    ).toThrow(
      [
        'Invalid SOFTURE configuration in module "blog":',
        "- options.contentDir: Too small: expected string to have >=1 characters",
        "- options.reservedSlugs.0: must be kebab-case, e.g. how-we-write",
        "- options.fields: must be an object schema, e.g. z.object({ scenario: z.string() })",
      ].join("\n"),
    );
  });

  it("refuses app fields that reuse a frontmatter key of the module", () => {
    expect(() => blog({ fields: z.object({ title: z.string(), scenario: z.string() }) })).toThrow('- options.fields.title: "title" is a frontmatter key of the module');
  });

  it("says the module is missing when the app did not enable it", () => {
    const config = { ...createConfig(), modules: [] };
    expect(() => getBlogOptions(config)).toThrow("@softure-ai/blog: the module is not enabled; add blog() to modules in softure.config.ts");
  });

  it("reports healthy once its table exists", async () => {
    const test = await createTestBlog();
    try {
      expect(await checkArticlesTable(test.ctx)).toEqual({ ok: true, value: undefined });
      await test.database.client.exec("DROP TABLE blog.articles CASCADE");
      await expect(checkArticlesTable(test.ctx)).rejects.toThrow();
    } finally {
      await test.database.close();
    }
  });
});
