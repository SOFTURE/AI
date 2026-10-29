// @vitest-environment happy-dom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { Accordion, AccordionItem, AccordionTrigger } from "../../src/ui/accordion.js";

afterEach(cleanup);

function readClasses(element: Element | null | undefined): string[] {
  return (element?.getAttribute("class") ?? "").split(/\s+/);
}

describe("AccordionTrigger", () => {
  it("has no touch height by default", () => {
    render(
      <Accordion type="single">
        <AccordionItem value="a">
          <AccordionTrigger>Billing</AccordionTrigger>
        </AccordionItem>
      </Accordion>,
    );

    expect(readClasses(screen.getByRole("button", { name: "Billing" }))).not.toContain("min-h-touch-target");
  });

  it("is at least 44 px high at the touch size, whatever padding a caller sets", () => {
    render(
      <Accordion type="single">
        <AccordionItem value="a">
          <AccordionTrigger size="touch" className="py-2 md:min-h-0">Billing</AccordionTrigger>
        </AccordionItem>
      </Accordion>,
    );

    expect(readClasses(screen.getByRole("button", { name: "Billing" }))).toEqual(expect.arrayContaining(["min-h-touch-target", "py-2", "md:min-h-0"]));
  });
});
