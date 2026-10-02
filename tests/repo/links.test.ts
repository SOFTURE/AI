import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { findBrokenLinks, listLinkTargets } from "./markdown-links.js";
import { listRepoFiles, REPO_ROOT } from "./repo-files.js";

describe("listLinkTargets", () => {
  it("lists inline links, images and reference definitions with their lines", () => {
    const text = "See [the plan](plan.md#goal) and ![chart](img/a.png).\n\n[ref]: ../docs/x.md\n";
    expect(listLinkTargets(text)).toEqual([
      { target: "plan.md#goal", line: 1 },
      { target: "img/a.png", line: 1 },
      { target: "../docs/x.md", line: 3 },
    ]);
  });

  it("ignores links inside code spans and fenced code blocks", () => {
    const text = "Use `[x](missing.md)` here.\n```md\n[y](missing.md)\n```\n~~~\n[z](missing.md)\n~~~\n";
    expect(listLinkTargets(text)).toEqual([]);
  });
});

describe("findBrokenLinks", () => {
  const files = new Set(["docs/a.md", "docs/b.md", "context/changes/x/plan.md", "README.md"]);

  it("accepts relative links to files and to folders that hold files", () => {
    const text = "[b](b.md) [plan](../context/changes/x/plan.md) [folder](../context/changes/x/) [root](/README.md)\n";
    expect(findBrokenLinks("docs/a.md", text, files)).toEqual([]);
  });

  it("ignores external links, mail links and same-page anchors", () => {
    const text = "[web](https://example.com/x.md) [mail](mailto:a@b.c) [top](#top)\n";
    expect(findBrokenLinks("docs/a.md", text, files)).toEqual([]);
  });

  it("decodes percent-encoded paths", () => {
    expect(findBrokenLinks("docs/a.md", "[b](b%2Emd)\n", files)).toEqual([]);
  });

  it("reports a link with a malformed percent escape instead of crashing", () => {
    expect(findBrokenLinks("docs/a.md", "[x](100%.md)\n", files)).toEqual([
      'docs/a.md:1: link "100%.md" is not a valid URL path',
    ]);
  });

  it("reports a relative link to a missing file with file, line and target", () => {
    expect(findBrokenLinks("docs/a.md", "ok\n[c](c.md)\n", files)).toEqual(['docs/a.md:2: broken link "c.md"']);
  });

  it("reports a link that leaves the repository", () => {
    expect(findBrokenLinks("docs/a.md", "[fire](../../FIRE_TRACKER/lefthook.yml)\n", files)).toEqual([
      'docs/a.md:1: link "../../FIRE_TRACKER/lefthook.yml" leaves the repository',
    ]);
  });
});

describe("the repository", () => {
  it("has no broken relative link in any Markdown file", () => {
    const repoFiles = listRepoFiles();
    const fileSet = new Set(repoFiles);
    const problems = repoFiles
      .filter((path) => path.endsWith(".md"))
      .flatMap((path) => findBrokenLinks(path, readFileSync(join(REPO_ROOT, path), "utf8"), fileSet));
    expect(problems).toEqual([]);
  });
});
