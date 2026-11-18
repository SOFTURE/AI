import { Slot } from "radix-ui";
import type { ComponentProps } from "react";

import { cn } from "../lib/utils.js";

/**
 * The text styles of a long read whose elements the app does not draw itself (Markdown rendered to HTML, a CMS body):
 * headings, paragraphs, lists, links, inline code and code blocks, quotes, tables and rules, all on the theme's tokens.
 * The same classes, for an app that styles its own wrapper.
 */
export const PROSE_CLASSES = cn(
  "min-w-0 text-body text-foreground",
  // Blocks: one rhythm between them, none before the first or after the last.
  "[&>*]:my-3 [&>*:first-child]:mt-0 [&>*:last-child]:mb-0",
  // Headings: the theme's heading styles, more room above than below, so a heading belongs to what follows it.
  "[&_h1]:mt-10 [&_h1]:mb-3 [&_h1]:text-heading-1 [&_h1]:text-balance",
  "[&_h2]:mt-8 [&_h2]:mb-2 [&_h2]:text-heading-2 [&_h2]:text-balance",
  "[&_h3]:mt-6 [&_h3]:mb-1 [&_h3]:text-heading-3",
  "[&_h4]:mt-4 [&_h4]:mb-1 [&_h4]:text-ui-medium",
  // Lists: markers in the quiet foreground, a little room between items.
  "[&_ul]:list-disc [&_ul]:pl-6 [&_ol]:list-decimal [&_ol]:pl-6 [&_li]:my-1 [&_li]:marker:text-muted-foreground",
  "[&_li>ul]:my-1 [&_li>ol]:my-1",
  // Inline: links in the link colour, underlined; strong text one weight up.
  "[&_a]:text-link [&_a]:underline [&_a]:underline-offset-2 [&_a:hover]:no-underline [&_strong]:font-semibold",
  // Inline code as `Code`; a block as `CodeBlock`, whose own code element drops the inline look.
  "[&_code]:rounded-xs [&_code]:bg-secondary [&_code]:px-1 [&_code]:font-mono [&_code]:text-code [&_code]:text-code-foreground",
  "[&_pre]:overflow-x-auto [&_pre]:rounded-lg [&_pre]:bg-muted [&_pre]:px-4 [&_pre]:py-3 [&_pre]:font-mono [&_pre]:text-code [&_pre]:whitespace-pre",
  "[&_pre_code]:bg-transparent [&_pre_code]:p-0 [&_pre_code]:text-foreground",
  // Quotes and rules: a quiet line.
  "[&_blockquote]:border-l-2 [&_blockquote]:border-border [&_blockquote]:pl-4 [&_blockquote]:text-muted-foreground",
  "[&_hr]:my-8 [&_hr]:border-border",
  // Tables: the UI text size, lines between rows, a header in the quiet foreground; a wide one scrolls in its block.
  "[&_table]:block [&_table]:w-full [&_table]:overflow-x-auto [&_table]:border-collapse [&_table]:text-ui",
  "[&_th]:border-b [&_th]:border-border [&_th]:px-2 [&_th]:py-1.5 [&_th]:text-start [&_th]:font-medium [&_th]:text-muted-foreground",
  "[&_td]:border-b [&_td]:border-border [&_td]:px-2 [&_td]:py-1.5 [&_td]:align-top",
);

export type ProseProps = ComponentProps<"div"> & {
  /** Renders the child element (an `article`, the app's `main`) with the prose classes. */
  readonly asChild?: boolean;
};

/**
 * A long read in the theme: wrap Markdown rendered to HTML (`dangerouslySetInnerHTML` of trusted content) or plain
 * elements, and every heading, list, link, code block, quote and table inside takes the theme's text styles.
 */
export function Prose({ asChild = false, className, ...props }: ProseProps) {
  const Comp = asChild ? Slot.Root : "div";
  return <Comp data-slot="prose" className={cn(PROSE_CLASSES, className)} {...props} />;
}
