// The article files of a content folder (issue #318): what `softure-blog` reads, for an app's own
// scripts and test stores, so they read the folder as the command does.
import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import type { ArticleFile } from "../db/publish-run.js";

export interface ArticleDirFile extends ArticleFile {
  /** `dir` joined with the file's name. */
  readonly path: string;
}

export type ReadArticleDirResult = { readonly ok: true; readonly files: readonly ArticleDirFile[] } | { readonly ok: false; readonly error: string };

/** Every `*.md` file directly in `dir` except `README.md`, sorted by name; or why the folder or a file cannot be read. */
export async function readArticleDir(dir: string): Promise<ReadArticleDirResult> {
  let names: string[];
  try {
    names = await readdir(dir);
  } catch {
    // The path is the useful part; the error code adds nothing an editor can act on.
    return { ok: false, error: `cannot read ${dir}` };
  }
  const files: ArticleDirFile[] = [];
  for (const name of names.filter((entry) => entry.endsWith(".md") && entry !== "README.md").sort()) {
    const path = join(dir, name);
    try {
      files.push({ name, text: await readFile(path, "utf8"), path });
    } catch {
      // As above: the path names the problem.
      return { ok: false, error: `cannot read ${path}` };
    }
  }
  return { ok: true, files };
}
