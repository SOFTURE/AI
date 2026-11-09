// The upload page module bundled and minified the way an app's production build ships it (Next.js minifies server
// code too), for tests that run the page's inline script.
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { build } from "esbuild";
import type { UploadStatus } from "../src/contract.js";
import type { FilesContext } from "../src/server/context.js";

export type RenderPage = (ctx: Pick<FilesContext, "config">, status: UploadStatus) => Response;

const PAGE_ENTRY = fileURLToPath(new URL("../src/server/upload-page.ts", import.meta.url));

/** Bundles and minifies `upload-page.ts` (workspace packages from source) into `outdir` and loads it. */
export async function bundleMinifiedPage(outdir: string): Promise<{ render: RenderPage; source: string }> {
  const outfile = join(outdir, "upload-page.mjs");
  await build({
    entryPoints: [PAGE_ENTRY],
    bundle: true,
    minify: true,
    platform: "node",
    format: "esm",
    target: "es2022",
    conditions: ["@softure-ai/source"],
    outfile,
    logLevel: "silent",
  });
  const loaded = (await import(/* @vite-ignore */ pathToFileURL(outfile).href)) as { renderUploadPage?: RenderPage };
  if (loaded.renderUploadPage === undefined) throw new Error(`setup: ${outfile} does not export renderUploadPage`);
  return { render: loaded.renderUploadPage, source: await readFile(outfile, "utf8") };
}
