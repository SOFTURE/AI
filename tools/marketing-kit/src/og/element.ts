/**
 * The element tree Satori lays out: the shape React elements have, built without React. A style is
 * a CSS-in-JS object in Satori's flexbox subset.
 */

export type OgStyle = Record<string, string | number>;

export type OgChild = OgNode | string;

export interface OgNode {
  type: string;
  props: { style?: OgStyle; children?: OgChild | OgChild[]; [attribute: string]: unknown };
}

/** `h("div", { style }, ...children)`: one element; empty children are dropped. */
export function h(type: string, props: OgNode["props"], ...children: (OgChild | null | false)[]): OgNode {
  const kept = children.filter((child): child is OgChild => child !== null && child !== false);
  if (kept.length === 0) return { type, props };
  return { type, props: { ...props, children: kept.length === 1 ? kept[0] : kept } };
}

/** Every node of a tree, the root first. */
export function listNodes(node: OgNode): OgNode[] {
  const children = node.props.children;
  const list = children === undefined ? [] : Array.isArray(children) ? children : [children];
  return [node, ...list.flatMap((child) => (typeof child === "string" ? [] : listNodes(child)))];
}
