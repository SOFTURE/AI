// @vitest-environment happy-dom
import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { FormGrid } from "../../src/notion/FormGrid.js";
import { Field, FieldLabel } from "../../src/ui/field.js";

afterEach(cleanup);

function getGrid(container: HTMLElement): HTMLElement {
  const grid = container.querySelector<HTMLElement>('[data-slot="form-grid"]');
  if (grid === null) throw new Error("render FormGrid: no grid");
  return grid;
}

describe("FormGrid", () => {
  it("lays two columns from md up and spans three rows per field by default", () => {
    const { container } = render(
      <FormGrid>
        <Field>
          <FieldLabel>Font</FieldLabel>
        </Field>
      </FormGrid>,
    );
    const grid = getGrid(container);

    expect(grid.getAttribute("data-columns")).toBe("2");
    expect(grid.style.getPropertyValue("--form-grid-rows")).toBe("3");
    expect(grid.className.split(" ")).toEqual(expect.arrayContaining(["grid", "grid-cols-1", "md:grid-cols-2", "*:data-[slot=field]:row-span-(--form-grid-rows)"]));
  });

  it.each([
    [1, ["grid-cols-1"], ["md:grid-cols-2"]],
    [3, ["grid-cols-1", "md:grid-cols-2", "lg:grid-cols-3"], []],
  ] as const)("takes %i columns", (columns, present, absent) => {
    const { container } = render(<FormGrid columns={columns} />);
    const classes = getGrid(container).className.split(" ");

    expect(classes).toEqual(expect.arrayContaining([...present]));
    for (const name of absent) expect(classes).not.toContain(name);
  });

  it("makes vertical fields subgrids that share the rows, and leaves horizontal fields their own layout", () => {
    const { container } = render(<FormGrid />);
    const classes = getGrid(container).className.split(" ");

    expect(classes).toEqual(
      expect.arrayContaining([
        "*:data-[slot=field]:data-[orientation=vertical]:grid",
        "*:data-[slot=field]:data-[orientation=vertical]:grid-rows-subgrid",
        "*:data-[slot=field]:data-[orientation=vertical]:*:m-0",
        "*:data-[slot=field]:data-[orientation=vertical]:*:first:self-end",
      ]),
    );
  });

  it.each([
    [4, "4"],
    [2.7, "2"],
    [0, "1"],
    [Number.NaN, "3"],
  ])("spans %s rows as %s", (rows, span) => {
    const { container } = render(<FormGrid rows={rows} />);

    expect(getGrid(container).style.getPropertyValue("--form-grid-rows")).toBe(span);
  });

  it("passes the app's classes, style and attributes through", () => {
    const { container } = render(<FormGrid className="max-w-xl" style={{ marginTop: "4px" }} aria-label="Brand" />);
    const grid = getGrid(container);

    expect([grid.classList.contains("max-w-xl"), grid.style.marginTop, grid.getAttribute("aria-label"), grid.style.getPropertyValue("--form-grid-rows")]).toEqual([
      true,
      "4px",
      "Brand",
      "3",
    ]);
  });
});
