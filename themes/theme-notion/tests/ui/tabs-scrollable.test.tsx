// @vitest-environment happy-dom
import { act, cleanup, fireEvent, render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { Tabs, TabsList, TabsTrigger } from "../../src/ui/tabs.js";

afterEach(cleanup);

const TABS = ["overview", "projects", "tasks", "documents", "invoices", "settings"] as const;
const TAB_WIDTH = 100;
const LIST_WIDTH = 300;

// happy-dom lays nothing out: each trigger is 100 px wide in a row, the list shows 300 px of it.
function layOut(list: HTMLElement) {
  Object.defineProperty(list, "clientWidth", { configurable: true, value: LIST_WIDTH });
  for (const [index, trigger] of [...list.querySelectorAll<HTMLElement>('[data-slot="tabs-trigger"]')].entries()) {
    Object.defineProperty(trigger, "offsetLeft", { configurable: true, value: index * TAB_WIDTH });
    Object.defineProperty(trigger, "offsetWidth", { configurable: true, value: TAB_WIDTH });
  }
}

function renderTabs(isScrollable: boolean, value?: string) {
  const view = render(
    <Tabs defaultValue="overview" {...(value === undefined ? {} : { value })}>
      <TabsList scrollable={isScrollable}>
        {TABS.map((tab) => (
          <TabsTrigger key={tab} value={tab}>
            {tab}
          </TabsTrigger>
        ))}
      </TabsList>
    </Tabs>,
  );
  const list = view.container.querySelector<HTMLElement>('[data-slot="tabs-list"]');
  if (list === null) throw new Error("no tabs list rendered");
  return { ...view, list };
}

describe("TabsList scrollable", () => {
  it("keeps to its container and scrolls sideways, with every trigger at its own width", () => {
    const { list, container } = renderTabs(true);
    const classes = (list.getAttribute("class") ?? "").split(" ");

    expect(list.getAttribute("data-scrollable")).toBe("true");
    expect(classes).toEqual(expect.arrayContaining(["w-full", "max-w-full", "min-w-0", "overflow-x-auto", "*:flex-none"]));
    expect(container.querySelector('[data-slot="tabs"]')?.getAttribute("class")?.split(" ")).toContain("has-data-[scrollable=true]:min-w-0");
  });

  it("leaves a plain list as it was", () => {
    const { list } = renderTabs(false);

    expect(list.hasAttribute("data-scrollable")).toBe(false);
    expect(list.getAttribute("class")?.split(" ")).not.toContain("overflow-x-auto");
  });

  it("scrolls the active trigger into the middle when the active tab changes", async () => {
    const { list, getByRole } = renderTabs(true);
    layOut(list);

    await act(async () => {
      fireEvent.mouseDown(getByRole("tab", { name: "invoices" }), { button: 0 });
      await Promise.resolve();
    });

    // The fifth tab starts at 400 px; centred in 300 px it is scrolled 300 px.
    expect(list.scrollLeft).toBe(4 * TAB_WIDTH - (LIST_WIDTH - TAB_WIDTH) / 2);
  });
});
