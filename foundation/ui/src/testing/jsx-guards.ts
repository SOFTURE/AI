import ts from "typescript";
import { type AllowedFile, type GuardSource, getLine, isAllowedFile, parseSource, walkNodes } from "./guard-source.js";

type JsxTag = ts.JsxOpeningElement | ts.JsxSelfClosingElement;

const HOVER_HANDLERS = ["onMouseEnter", "onMouseOver", "onPointerEnter", "onPointerOver"];
const FOCUS_HANDLERS = new Set(["onFocus", "onFocusCapture"]);

/**
 * The HTML and SVG elements with a `title` attribute, as `file:line: <tag title>`. A native tooltip
 * never shows on touch and keyboard; `Hint` is the tooltip. A component's `title` prop (`<Card title>`)
 * and an SVG `<title>` child pass.
 */
export function findNativeTooltips(sources: readonly GuardSource[]): string[] {
  return findTags(sources, (tag, name, file) =>
    isIntrinsic(name) && getAttributeNames(tag).includes("title") ? [`${file}: <${name} title>`] : [],
  );
}

/**
 * The elements that open something on mouse or pointer enter but not on focus, as
 * `file:line: <tag onMouseEnter> without onFocus`: what opens on hover must open for the keyboard too.
 * An element with spread props (`{...hover}`) passes, since the spread may carry `onFocus`.
 */
export function findHoverOnlyHandlers(sources: readonly GuardSource[]): string[] {
  return findTags(sources, (tag, name, file) => {
    if (tag.attributes.properties.some(ts.isJsxSpreadAttribute)) return [];
    const attributes = getAttributeNames(tag);
    const hover = HOVER_HANDLERS.find((handler) => attributes.includes(handler));
    if (hover === undefined || attributes.some((attribute) => FOCUS_HANDLERS.has(attribute))) return [];
    return [`${file}: <${name} ${hover}> without onFocus`];
  });
}

export interface RestrictedElementOptions {
  /** Files allowed to render a raw `<select>` (the one `Select` implementation); checked when given. */
  readonly select?: readonly AllowedFile[];
  /** Files allowed to call `createPortal` (the one `Modal` implementation); checked when given. */
  readonly createPortal?: readonly AllowedFile[];
}

/**
 * Raw `<select>` elements and `createPortal` calls outside the files allowed for them, as
 * `file:line: <select>` or `file:line: createPortal`: one implementation owns each, so focus, keyboard
 * and layering behave the same on every screen. Only the keys given in `options` are checked.
 */
export function findRestrictedElements(sources: readonly GuardSource[], options: RestrictedElementOptions): string[] {
  const { select, createPortal } = options;
  return sources.flatMap((source) => {
    const file = parseSource(source);
    const found: string[] = [];
    walkNodes(file, (node) => {
      const at = `${source.file}:${String(getLine(file, node.getStart(file)))}`;
      if (select !== undefined && isJsxTag(node) && node.tagName.getText(file) === "select" && !isAllowedFile(source.file, select)) {
        found.push(`${at}: <select>`);
      }
      if (createPortal !== undefined && ts.isCallExpression(node) && isCreatePortal(node.expression) && !isAllowedFile(source.file, createPortal)) {
        found.push(`${at}: createPortal`);
      }
    });
    return found;
  });
}

function findTags(sources: readonly GuardSource[], check: (tag: JsxTag, name: string, at: string) => string[]): string[] {
  return sources.flatMap((source) => {
    const file = parseSource(source);
    const found: string[] = [];
    walkNodes(file, (node) => {
      if (!isJsxTag(node)) return;
      const at = `${source.file}:${String(getLine(file, node.getStart(file)))}`;
      found.push(...check(node, node.tagName.getText(file), at));
    });
    return found;
  });
}

function isJsxTag(node: ts.Node): node is JsxTag {
  return ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node);
}

/** An HTML or SVG element: a lowercase name without a dot (`div`, `svg`), not a component. */
function isIntrinsic(name: string): boolean {
  return /^[a-z][\w-]*$/.test(name);
}

function getAttributeNames(tag: JsxTag): string[] {
  return tag.attributes.properties.flatMap((property) => (ts.isJsxAttribute(property) ? [property.name.getText()] : []));
}

function isCreatePortal(callee: ts.Expression): boolean {
  if (ts.isIdentifier(callee)) return callee.text === "createPortal";
  return ts.isPropertyAccessExpression(callee) && callee.name.text === "createPortal";
}
