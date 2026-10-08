// The module definition: its manifest, its options and its health check.
import { readFileSync } from "node:fs";
import { defineSoftureConfig, toModuleJson } from "@softure-ai/core";
import { BLOG_RATE_LIMIT_BUCKETS, blog } from "@softure-ai/blog";
import { BLOG_REFRESH_RATE_LIMIT_BUCKET, checkArticlesTable, getBlogOptions, getBlogRefreshPath, getBlogReservedSlugs, getBlogRoutes } from "@softure-ai/blog/server";
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

  it("fills in the defaults: content/blog, no reserved slugs, no app fields, no brand or method page, the full link marker, no 410 links", () => {
    const { quality, ...rest } = blog().options;
    expect(rest).toEqual({
      contentDir: "content/blog",
      reservedSlugs: [],
      methodPage: false,
      clusters: {},
      blocks: [],
      siteHosts: [],
      externalLinkMarker: "icon-and-text",
      gonePage: { links: [] },
      revalidateSeconds: 300,
      skill: { sections: [] },
    });
    // No paths of its own: the quality gate takes them from the routes (`getQualitySettings(config).paths`).
    expect(quality).toMatchObject({ language: "en", ymyl: null, paths: {}, plugins: [] });
  });

  it("serves its pages under /blog unless the app moves them, and reserves their slugs", () => {
    expect(getBlogRoutes(createConfig())).toEqual({ index: "/blog", glossary: "/blog/glossary", method: "/blog/how-we-write", rss: "/blog/rss.xml" });
    const config = defineSoftureConfig({
      database: { url: "pglite://" },
      locale: "en",
      timezone: "UTC",
      appOrigin: "https://app.example.com",
      modules: [blog({ routes: { index: "/articles/", glossary: "/articles/terms" }, methodPage: true, reservedSlugs: ["about"] })],
    });
    expect(getBlogRoutes(config)).toEqual({ index: "/articles", glossary: "/articles/terms", method: "/blog/how-we-write", rss: "/blog/rss.xml" });
    expect(getBlogReservedSlugs(config)).toEqual(["about", "terms"]);
  });

  it("serves the cache refresh route at /api/blog/refresh unless the app moves it, rate-limited in its own bucket", () => {
    expect(getBlogRefreshPath(createConfig())).toBe("/api/blog/refresh");
    const config = defineSoftureConfig({
      database: { url: "pglite://" },
      locale: "en",
      timezone: "UTC",
      appOrigin: "https://app.example.com",
      modules: [blog({ routes: { refresh: "/internal/blog-refresh/" } })],
    });
    expect(getBlogRefreshPath(config)).toBe("/internal/blog-refresh");
    expect(BLOG_RATE_LIMIT_BUCKETS).toEqual({ [BLOG_REFRESH_RATE_LIMIT_BUCKET]: { limit: 10, windowMinutes: 15 } });
    expect(blog.manifest.env.map((variable) => variable.name)).toEqual(["BLOG_REFRESH_SECRET"]);
  });

  it("takes a brand, a disclaimer, cluster labels and block plugins", () => {
    const chart = { type: "chart", render: () => ({ kind: "html" as const, html: "<figure></figure>" }) };
    const options = blog({
      brand: { name: "Example", colors: { accent: "#cff26b" } },
      disclaimer: { en: "Not advice." },
      clusters: { "investing-basics": { en: "Investing basics", pl: "Podstawy" } },
      blocks: [chart],
      siteHosts: ["docs.example.com"],
    }).options;
    expect(options).toMatchObject({ brand: { name: "Example", colors: { accent: "#cff26b" } }, disclaimer: { en: "Not advice." }, blocks: [chart] });
  });

  it("takes the app's own sections of the writing skill, a ### heading in a body included", () => {
    const sections = [{ title: "Engine numbers", body: "Take every number from the engine.\n\n### Rounding\n\nRound to whole units." }];
    expect(blog({ skill: { sections } }).options.skill).toEqual({ sections });
  });

  it("refuses skill sections that would break the generated file", () => {
    expect(() =>
      blog({
        skill: {
          sections: [
            { title: " ", body: "Text." },
            { title: "Two\nlines", body: "Text." },
            { title: "Chart block", body: "  " },
            { title: "Scenario", body: "Intro.\n## Own heading\nText." },
          ],
        },
      }),
    ).toThrow(
      [
        'Invalid SOFTURE configuration in module "blog":',
        "- options.skill.sections.0.title: Too small: expected string to have >=1 characters",
        "- options.skill.sections.1.title: must be one line",
        "- options.skill.sections.2.body: Too small: expected string to have >=1 characters",
        "- options.skill.sections.3.body: must not hold a # or ## heading; use ### and deeper (the title is the section's ## heading)",
      ].join("\n"),
    );
  });

  it("refuses two skill sections with one title and any # or ## heading line, and lets fenced code hold a # line", () => {
    const body = "Run it:\n\n```bash\n# the engine\nnpm run engine\n```";
    expect(blog({ skill: { sections: [{ title: "Engine", body }] } }).options.skill.sections[0]?.body).toBe(body);
    for (const heading of ["Intro.\r\n##\r\nText.", "Intro.\n   # Indented\nText."]) {
      expect(() => blog({ skill: { sections: [{ title: "Engine", body: heading }] } }), JSON.stringify(heading)).toThrow("must not hold a # or ## heading");
    }
    expect(blog({ skill: { sections: [{ title: "Engine", body: "#hashtag and ### Deeper" }] } }).options.skill.sections).toHaveLength(1);
    expect(() => blog({ skill: { sections: [{ title: "Engine", body: "One." }, { title: "Engine", body: "Two." }] } })).toThrow(
      '- options.skill.sections.1.title: "Engine" is the title of another section',
    );
  });

  it("refuses page options it cannot use", () => {
    expect(() =>
      blog({
        brand: { name: "Example", colors: { accent: "lime" } },
        // @ts-expect-error: a block plugin needs a render function.
        blocks: [{ type: "chart" }],
        siteHosts: ["https://example.com"],
        revalidateSeconds: 0,
      }),
    ).toThrow(
      [
        'Invalid SOFTURE configuration in module "blog":',
        "- options.brand.colors.accent: must be a six-digit hex colour, e.g. #0c0c0d",
        '- options.blocks.0: must be a block plugin: { type: "chart", render(block) }',
        "- options.siteHosts.0: must be a host name, e.g. example.com",
        "- options.revalidateSeconds: Too small: expected number to be >=1",
      ].join("\n"),
    );
  });

  it("takes the OG card's fonts, upright 400 by default", () => {
    const fonts = blog({
      brand: { name: "Example", fonts: [{ name: "Inter", src: "fonts/inter-400.woff" }, { name: "Inter", weight: 700, src: "https://cdn.example.com/inter-700.ttf?v=2" }] },
    }).options.brand?.fonts;
    expect(fonts).toEqual([
      { name: "Inter", weight: 400, style: "normal", src: "fonts/inter-400.woff" },
      { name: "Inter", weight: 700, style: "normal", src: "https://cdn.example.com/inter-700.ttf?v=2" },
    ]);
  });

  it("refuses OG card fonts the card cannot read", () => {
    expect(() =>
      blog({
        brand: {
          name: "Example",
          fonts: [
            { name: "Inter", src: "http://cdn.example.com/inter.ttf" },
            { name: "Inter", src: "https://cdn.example.com/inter.woff2?v=3" },
            { name: "Inter", src: "fonts/inter.WOFF2" },
            // @ts-expect-error: Satori takes weights in steps of 100.
            { name: "Inter", weight: 450, src: "fonts/inter.woff" },
          ],
        },
      }),
    ).toThrow(
      [
        'Invalid SOFTURE configuration in module "blog":',
        "- options.brand.fonts.0.src: must be an https URL or a file path, e.g. fonts/inter-700.woff",
        "- options.brand.fonts.1.src: must be a .ttf, .otf or .woff file; the card cannot read .woff2",
        "- options.brand.fonts.2.src: must be a .ttf, .otf or .woff file; the card cannot read .woff2",
        "- options.brand.fonts.3.weight: must be a weight from 100 to 900 in steps of 100",
      ].join("\n"),
    );
    expect(() => blog({ brand: { name: "Example", fonts: [] } })).toThrow("- options.brand.fonts: must list at least one font");
    const twice = [
      { name: "Mono", weight: 700, src: "fonts/mono-a.woff" },
      { name: "Mono", weight: 700, style: "italic", src: "fonts/mono-a-italic.woff" },
      { name: "Mono", weight: 700, src: "fonts/mono-b.woff" },
    ] as const;
    expect(() => blog({ brand: { name: "Example", fonts: [...twice] } })).toThrow(
      '- options.brand.fonts.2: "Mono" 700 normal is listed twice; give a second file its own name, e.g. "Mono Ext"',
    );
  });

  it("takes an image policy, with no extra hosts by default", () => {
    const dimensions = () => ({ width: 800, height: 450 });
    expect(blog({ images: { dimensions } }).options.images).toEqual({ hosts: [], dimensions });
  });

  it("refuses an image policy it cannot use", () => {
    expect(() =>
      // @ts-expect-error: the size resolver must be a function.
      blog({ images: { hosts: ["https://cdn.example.com"], dimensions: { "/a.png": [1, 1] } } }),
    ).toThrow(
      [
        'Invalid SOFTURE configuration in module "blog":',
        "- options.images.hosts.0: must be a host name, e.g. cdn.example.com",
        "- options.images.dimensions: must be a function: (src) => ({ width, height }) or null",
      ].join("\n"),
    );
  });

  it("takes the app's folder, reserved slugs and fields schema", () => {
    const fields = z.object({ scenario: z.string().optional() });
    const options = blog({ contentDir: "posts", reservedSlugs: ["glossary"], fields }).options;
    expect(options).toMatchObject({ contentDir: "posts", reservedSlugs: ["glossary"], fields });
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
