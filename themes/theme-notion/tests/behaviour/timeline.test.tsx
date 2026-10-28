// @vitest-environment happy-dom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { Timeline } from "../../src/index.js";

afterEach(cleanup);

describe("Timeline", () => {
  it("calls onSelect when the entry's button is clicked, and not for a click on its aside", () => {
    const onSelect = vi.fn();
    const onMark = vi.fn();
    render(
      <Timeline
        label="Trip"
        items={[
          {
            key: "lisbon",
            title: "Lisbon",
            onSelect,
            actionLabel: "Show on the map",
            aside: (
              <button type="button" onClick={onMark}>
                Marks
              </button>
            ),
          },
        ]}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Marks" }));
    expect(onSelect).not.toHaveBeenCalled();
    expect(onMark).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole("button", { name: /^Show on the map: .*Lisbon/ }));
    expect(onSelect).toHaveBeenCalledTimes(1);
  });

  it("names the list and keeps the entries in order", () => {
    render(<Timeline label="Trip" items={[{ key: "a", title: "Lisbon" }, { key: "b", title: "Porto" }]} />);

    const list = screen.getByRole("list", { name: "Trip" });
    expect([...list.querySelectorAll("li")].map((item) => item.textContent)).toEqual(["Lisbon", "Porto"]);
  });
});
