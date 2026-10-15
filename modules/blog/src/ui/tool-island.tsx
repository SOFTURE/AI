"use client";

import { Suspense, useSyncExternalStore, type ReactNode } from "react";
import type { ToolBlockMode } from "../render/tool-block.js";

// The mount point of a tool block (GitHub issues 413, 509). The server and the first client render show the tool's
// static HTML, so bots and readers without JavaScript get it and hydration matches. Once hydrated, the island (the
// `children`, rendered by `renderToolNode` with the tool's parsed props) takes the static HTML's place (`replace`) or
// mounts in an element right after it (`append`). The island is therefore never rendered on the server and may use
// browser APIs. A lazy island (`lazyToolIsland`) starts loading only then; until it resolves, the mount point keeps
// the static HTML (`replace`) or an empty island element (`append`).

export interface BlogToolIslandProps {
  /** The directive's name, set as `data-blog-tool`. */
  readonly name: string;
  /** The tool's name on a shared directive (`defineToolBlocks`), set as `data-blog-tool-type`. */
  readonly tool?: string;
  readonly className: string;
  /** The tool's static HTML (the app's trusted output of `renderStatic`). */
  readonly html: string;
  /** Default: `replace`. */
  readonly mode?: ToolBlockMode;
  /** The island element. */
  readonly children: ReactNode;
}

function subscribe(): () => void {
  return () => undefined;
}

function getClientSnapshot(): boolean {
  return true;
}

function getServerSnapshot(): boolean {
  return false;
}

export function BlogToolIsland({ name, tool, className, html, mode = "replace", children }: BlogToolIslandProps) {
  const isHydrated = useSyncExternalStore(subscribe, getClientSnapshot, getServerSnapshot);
  const toolType = tool === undefined || tool === name ? undefined : tool;
  if (mode === "append") {
    return (
      <div className={className} data-blog-tool={name} data-blog-tool-type={toolType} data-mode="append" data-state={isHydrated ? "live" : "static"}>
        <div data-blog-tool-part="static" dangerouslySetInnerHTML={{ __html: html }} />
        <div data-blog-tool-part="island">{isHydrated ? <Suspense fallback={null}>{children}</Suspense> : null}</div>
      </div>
    );
  }
  const staticMount = <div className={className} data-blog-tool={name} data-blog-tool-type={toolType} data-state="static" dangerouslySetInnerHTML={{ __html: html }} />;
  return (
    <Suspense fallback={staticMount}>
      {isHydrated ? (
        <div className={className} data-blog-tool={name} data-blog-tool-type={toolType} data-state="live">
          {children}
        </div>
      ) : (
        staticMount
      )}
    </Suspense>
  );
}
