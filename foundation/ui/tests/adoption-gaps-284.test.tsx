import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { Field, SelectField, TextField } from "../src/index.js";

const ROW = /<div class="([^"]*)"><label for="rate" class="([^"]*)">Rate<\/label>(?:<span class="([^"]*)">)?/;

describe("Field tooltip hint layout (#284)", () => {
  it("lays the tooltip \"?\" inline after the label, with room reserved at the label's end", () => {
    const html = renderToStaticMarkup(
      <Field label="Rate" fieldId="rate" hint="Yearly" hintAs="tooltip">
        <input id="rate" />
      </Field>,
    );
    const row = html.match(ROW);
    expect(row?.[1]).toBe("sft:mb-1.5 sft:block sft:text-sm");
    expect(row?.[2]?.split(" ")).toContain("sft:pr-5");
    expect(row?.[3]).toBe("sft:-ml-5 sft:inline-flex sft:w-5 sft:justify-end");
  });

  it("reserves no room and renders no wrapper for a block hint", () => {
    const html = renderToStaticMarkup(
      <Field label="Rate" fieldId="rate" hint="Yearly">
        <input id="rate" />
      </Field>,
    );
    expect(html).not.toContain("sft:pr-5");
    expect(html).toMatch(/<label for="rate" class="[^"]*">Rate<\/label><\/div>/);
  });

  it("takes the tooltip slot on the wrapper, and only the app's classes when unstyled", () => {
    const html = renderToStaticMarkup(
      <Field label="Rate" fieldId="rate" hint="Yearly" hintAs="tooltip" unstyled classNames={{ label: "app-label", tooltip: "app-tooltip" }}>
        <input id="rate" />
      </Field>,
    );
    expect(html).toMatch(/<label for="rate" class="app-label">Rate<\/label><span class="app-tooltip"><span class="sft:group\/hint/);
  });

  it("forwards the tooltip slot from TextField and SelectField", () => {
    const text = renderToStaticMarkup(
      <TextField id="rate" name="rate" label="Rate" hint="Yearly" hintAs="tooltip" classNames={{ tooltip: "app-tooltip" }} />,
    );
    const select = renderToStaticMarkup(
      <SelectField
        id="rate"
        name="rate"
        label="Rate"
        hint="Yearly"
        hintAs="tooltip"
        options={[{ value: "a", label: "A" }]}
        classNames={{ tooltip: "app-tooltip" }}
      />,
    );
    expect(text).toMatch(/<\/label><span class="[^"]*app-tooltip">/);
    expect(select).toMatch(/<\/label><span class="[^"]*app-tooltip">/);
  });
});
