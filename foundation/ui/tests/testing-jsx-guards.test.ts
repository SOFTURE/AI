import { describe, expect, it } from "vitest";
import { findHoverOnlyHandlers, findNativeTooltips, findRestrictedElements, type GuardSource } from "../src/testing/index.js";

function sourceOf(source: string, file = "app/view.tsx"): GuardSource[] {
  return [{ file, source }];
}

describe("findNativeTooltips", () => {
  it("reports a title attribute on an HTML or SVG element", () => {
    const source = `export const A = () => (\n  <span title="Saved">\n    <svg title={label} />\n  </span>\n);`;
    expect(findNativeTooltips(sourceOf(source))).toEqual(["app/view.tsx:2: <span title>", "app/view.tsx:3: <svg title>"]);
  });

  it("passes a component's title prop, a member component and an SVG <title> child", () => {
    const source = `<Card title="Plan"><Modal.Root title={t} /><svg><title>{label}</title></svg></Card>`;
    expect(findNativeTooltips(sourceOf(source))).toEqual([]);
  });

  it("returns an empty list for no sources", () => {
    expect(findNativeTooltips([])).toEqual([]);
  });
});

describe("findHoverOnlyHandlers", () => {
  it("reports an element that opens on mouse or pointer enter but not on focus", () => {
    const source = [
      "<>",
      "  <span onMouseEnter={open} onMouseLeave={close} />",
      "  <Trigger onPointerEnter={open} />",
      "  <div onMouseOver={open}>x</div>",
      "</>",
    ].join("\n");
    expect(findHoverOnlyHandlers(sourceOf(source))).toEqual([
      "app/view.tsx:2: <span onMouseEnter> without onFocus",
      "app/view.tsx:3: <Trigger onPointerEnter> without onFocus",
      "app/view.tsx:4: <div onMouseOver> without onFocus",
    ]);
  });

  it("passes an element that also opens on focus, and one whose props are spread", () => {
    const source = `<><span onMouseEnter={open} onFocus={open} /><span onPointerEnter={open} onFocusCapture={open} /><span {...hover} onMouseEnter={open} /></>`;
    expect(findHoverOnlyHandlers(sourceOf(source))).toEqual([]);
  });
});

describe("findRestrictedElements", () => {
  const source = [
    'import { createPortal } from "react-dom";',
    'import * as ReactDOM from "react-dom";',
    "export const A = () => <select name={name} />;",
    "export const B = () => createPortal(<p />, document.body);",
    "export const C = () => ReactDOM.createPortal(<p />, document.body);",
    "// createPortal and <select> in a comment do not count",
  ].join("\n");

  it("reports raw <select> and createPortal outside the allowed files", () => {
    expect(findRestrictedElements(sourceOf(source), { select: ["ui/select.tsx"], createPortal: [/modal\.tsx$/] })).toEqual([
      "app/view.tsx:3: <select>",
      "app/view.tsx:4: createPortal",
      "app/view.tsx:5: createPortal",
    ]);
  });

  it("passes them in an allowed file, matched exactly, by its end or by a pattern", () => {
    const files: GuardSource[] = [
      { file: "src/ui/select.tsx", source: "<select />" },
      { file: "src/ui/modal.tsx", source: "createPortal(a, b);" },
      { file: "components/Picker.tsx", source: "<select />" },
    ];
    const options = { select: ["ui/select.tsx", "components/Picker.tsx"], createPortal: [/\/modal\.tsx$/] };
    expect(findRestrictedElements(files, options)).toEqual([]);
  });

  it("checks only the elements named in the options", () => {
    expect(findRestrictedElements(sourceOf(source), { select: [] })).toEqual(["app/view.tsx:3: <select>"]);
    expect(findRestrictedElements(sourceOf(source), {})).toEqual([]);
  });

  it("passes a component named Select and a method named createPortal on something else", () => {
    const other = `<Select options={o} />;\nconst p = portals.createPortalFor(x);`;
    expect(findRestrictedElements(sourceOf(other), { select: [], createPortal: [] })).toEqual([]);
  });
});
