import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import * as icons from "../src/ui/icons.js";

const ICONS = Object.entries(icons).filter(([name]) => name.endsWith("Icon"));

describe("icons", () => {
  it("has a set to check", () => {
    expect(ICONS.length).toBe(35);
  });

  it("draws every icon on one frame: 24 grid, 2-unit stroke, currentColor, hidden", () => {
    for (const [name, Icon] of ICONS) {
      const html = renderToStaticMarkup(<Icon />);
      expect(html, name).toMatch(
        /^<svg width="1[46]" height="1[46]" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">/,
      );
    }
  });

  it("sets the side from size, 16 px by default (pencil and refresh 14 px)", () => {
    expect(renderToStaticMarkup(<icons.PlusIcon size={20} />)).toContain('width="20" height="20"');
    expect(renderToStaticMarkup(<icons.PlusIcon />)).toContain('width="16"');
    expect(renderToStaticMarkup(<icons.PencilIcon />)).toContain('width="14"');
    expect(renderToStaticMarkup(<icons.RefreshIcon />)).toContain('width="14"');
  });

  it("passes the class to the svg", () => {
    expect(renderToStaticMarkup(<icons.CheckIcon className="app-icon" />)).toContain('class="app-icon"');
  });
});
