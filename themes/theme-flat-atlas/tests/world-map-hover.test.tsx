// @vitest-environment happy-dom
import { cleanup, fireEvent, render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { WorldMap } from "../src/world-map.js";

afterEach(() => {
  cleanup();
});

function renderMap() {
  const view = render(<WorldMap label="map" countries={{ "616": "visited" }} countryLabels={{ "616": "Polska", "276": "Niemcy" }} />);
  const layer = view.container.querySelector<HTMLElement>('[data-slot="world-map"] > div');
  const poland = view.container.querySelector<SVGPathElement>('path[data-id="616"]');
  const france = view.container.querySelector<SVGPathElement>('path[data-id="250"]');
  if (layer === null || poland === null || france === null) throw new Error("WorldMap did not render its layer and countries");
  layer.getBoundingClientRect = () => ({ left: 0, top: 0, width: 1000, height: 500, right: 1000, bottom: 500, x: 0, y: 0, toJSON: () => ({}) });
  return { view, poland, france };
}

function getTag(container: HTMLElement) {
  return container.querySelector<HTMLElement>('[data-slot="world-map-country-tag"]');
}

describe("WorldMap country names on hover", () => {
  it("shows the country's name at the mouse pointer and lifts the country a shade", () => {
    const { view, poland } = renderMap();
    fireEvent.pointerMove(poland, { pointerType: "mouse", clientX: 520, clientY: 120 });
    const tag = getTag(view.container);
    expect(tag?.textContent).toBe("Polska");
    expect(tag?.style.left).toBe("52%");
    expect(tag?.style.top).toBe("24%");
    expect(poland.hasAttribute("data-hovered")).toBe(true);
  });

  it("shows nothing for a country without a name, for touch, and once the pointer leaves", () => {
    const { view, poland, france } = renderMap();
    fireEvent.pointerMove(france, { pointerType: "mouse", clientX: 480, clientY: 140 });
    expect(getTag(view.container)).toBeNull();
    fireEvent.pointerMove(poland, { pointerType: "touch", clientX: 520, clientY: 120 });
    expect(getTag(view.container)).toBeNull();
    fireEvent.pointerMove(poland, { pointerType: "mouse", clientX: 520, clientY: 120 });
    expect(getTag(view.container)).not.toBeNull();
    fireEvent.pointerLeave(poland.closest('[data-slot="world-map"] > div') ?? poland);
    expect(getTag(view.container)).toBeNull();
    expect(poland.hasAttribute("data-hovered")).toBe(false);
  });

  it("lets the pointer through the overlay layer to the countries", () => {
    const { view } = renderMap();
    const overlay = view.container.querySelector('[data-slot="world-map"] svg + div');
    expect(overlay?.className).toContain("pointer-events-none");
    expect(overlay?.className).toContain("*:pointer-events-auto");
  });
});
