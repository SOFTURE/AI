// markdown-it ships its own types since 15.0.3, while @types/markdown-it-footnote is written against
// @types/markdown-it, so its plugin no longer fits `md.use`. This declaration types the plugin against
// the types markdown-it ships.
declare module "markdown-it-footnote" {
  import type { MarkdownIt } from "markdown-it";

  export default function footnote(md: MarkdownIt): void;
}
