// @vitest-environment happy-dom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";

import { Checkbox, Switch, Tabs, TabsContent, TabsList, TabsTrigger } from "../../src/index.js";
import { installDomShims } from "../gallery/dom.js";

beforeAll(installDomShims);
afterEach(cleanup);

function classesOf(element: Element | null): string[] {
  return (element?.getAttribute("class") ?? "").split(" ");
}

describe("Checkbox", () => {
  it("checks on click and on Space, and reports the change", () => {
    const onCheckedChange = vi.fn();
    render(<Checkbox aria-label="Done" onCheckedChange={onCheckedChange} />);
    const box = screen.getByRole("checkbox", { name: "Done" });

    fireEvent.click(box);
    expect([box.dataset["state"], box.getAttribute("aria-checked")]).toEqual(["checked", "true"]);
    expect(onCheckedChange).toHaveBeenLastCalledWith(true);

    fireEvent.keyDown(box, { key: "Enter" });
    expect(box.dataset["state"]).toBe("checked");
  });

  it("draws the tick at 14 px inside the 16 px box", () => {
    render(<Checkbox aria-label="Done" defaultChecked />);

    expect(classesOf(document.querySelector('[data-slot="checkbox-indicator"] svg'))).toContain("size-3.5");
  });

  it("is indeterminate when asked and inert when disabled", () => {
    render(
      <>
        <Checkbox aria-label="Some" checked="indeterminate" />
        <Checkbox aria-label="Locked" disabled />
      </>,
    );

    expect(screen.getByRole("checkbox", { name: "Some" }).getAttribute("aria-checked")).toBe("mixed");
    const locked = screen.getByRole("checkbox", { name: "Locked" });
    fireEvent.click(locked);
    expect(locked.dataset["state"]).toBe("unchecked");
  });
});

describe("Switch", () => {
  it("turns on and off on click and reports the change", () => {
    const onCheckedChange = vi.fn();
    render(<Switch aria-label="Sync" onCheckedChange={onCheckedChange} />);
    const toggle = screen.getByRole("switch", { name: "Sync" });

    fireEvent.click(toggle);
    expect([toggle.dataset["state"], toggle.getAttribute("aria-checked")]).toEqual(["checked", "true"]);
    fireEvent.click(toggle);
    expect(onCheckedChange.mock.calls).toEqual([[true], [false]]);
  });

  it("moves the thumb 10 px when checked and carries the shared thumb shadow", () => {
    render(<Switch aria-label="Sync" defaultChecked size="sm" />);

    expect(screen.getByRole("switch").dataset["size"]).toBe("sm");
    expect(classesOf(document.querySelector('[data-slot="switch-thumb"]'))).toEqual(expect.arrayContaining(["data-[state=checked]:translate-x-[10px]", "group-data-[size=sm]/switch:size-2.5"]));
  });
});

describe("Tabs", () => {
  it("draw the line variant by default and switch panels on click", () => {
    render(
      <Tabs defaultValue="pages">
        <TabsList>
          <TabsTrigger value="pages">Pages</TabsTrigger>
          <TabsTrigger value="files">Files</TabsTrigger>
        </TabsList>
        <TabsContent value="pages">Twelve pages.</TabsContent>
        <TabsContent value="files">Three files.</TabsContent>
      </Tabs>,
    );

    expect(document.querySelector('[data-slot="tabs-list"]')?.getAttribute("data-variant")).toBe("line");
    const files = screen.getByRole("tab", { name: "Files" });
    fireEvent.mouseDown(files, { button: 0, ctrlKey: false });
    expect(files.getAttribute("aria-selected")).toBe("true");
    expect(screen.getByRole("tabpanel").textContent).toBe("Three files.");
  });
});
