import type { ComponentProps } from "react";

import { cn } from "../lib/utils.js";

// Inline code: the `code` text style in mono, red on the grey `secondary` background, as in Notion.
export function Code({ className, ...props }: ComponentProps<"code">) {
  return (
    <code
      data-slot="code"
      className={cn("rounded-xs bg-secondary px-1 font-mono text-code text-code-foreground", className)}
      {...props}
    />
  );
}

export interface CodeBlockProps extends ComponentProps<"pre"> {
  // The block's accessible name; with it the block is a named region keyboard users can focus and scroll.
  readonly label?: string;
  // Wrap long lines instead of scrolling sideways.
  readonly wrap?: boolean;
}

// A mono block for logs and file paths, without syntax highlighting.
export function CodeBlock({ label, wrap = false, className, ...props }: CodeBlockProps) {
  const region = label === undefined ? {} : { role: "region", "aria-label": label, tabIndex: 0 };
  return (
    <pre
      data-slot="code-block"
      data-wrap={wrap ? "" : undefined}
      className={cn(
        "overflow-x-auto rounded-lg bg-muted px-4 py-3 font-mono text-code",
        wrap ? "whitespace-pre-wrap break-words" : "whitespace-pre",
        className,
      )}
      {...region}
      {...props}
    />
  );
}
