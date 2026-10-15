// A tool block's page node (`BlogToolNode`, plain data from the config's plugin) rendered with the app's client
// island (GitHub issue 509). The island map is the app's: tool name → a `"use client"` component, eager or
// `lazyToolIsland(() => import(…))`. A tool without an island keeps its static HTML.
import type { ComponentType, LazyExoticComponent } from "react";
import type { BlogToolNode } from "../render/tool-block.js";
import { BlogToolIsland } from "./tool-island.js";

/**
 * A tool's client component. Its props are the tool's own type, checked on the config side by the tool's schema;
 * the page only passes the parsed props through, so it cannot link the two types.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- see above: each island takes its own tool's props.
export type ToolIslandComponent = ComponentType<any> | LazyExoticComponent<ComponentType<any>>;

/** The app's islands by tool name (the directive's name, or the `type` of a shared directive). */
export type BlogToolIslands = Readonly<Record<string, ToolIslandComponent>>;

export function renderToolNode(node: BlogToolNode, islands: BlogToolIslands) {
  const Island = Object.hasOwn(islands, node.tool) ? islands[node.tool] : undefined;
  const toolType = node.tool === node.directive ? undefined : node.tool;
  if (Island === undefined) {
    return <div className={node.className} data-blog-tool={node.directive} data-blog-tool-type={toolType} data-state="static" dangerouslySetInnerHTML={{ __html: node.html }} />;
  }
  return (
    <BlogToolIsland name={node.directive} tool={node.tool} className={node.className} html={node.html} mode={node.mode}>
      <Island {...node.props} />
    </BlogToolIsland>
  );
}
