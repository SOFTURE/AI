// @vitest-environment happy-dom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { renderToString } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";

import { notionMessages } from "../../src/messages/index.js";
import { FileInput } from "../../src/notion/FileInput.js";
import { Field, FieldLabel } from "../../src/ui/field.js";
import { Input } from "../../src/ui/input.js";
import { Select, SelectTrigger } from "../../src/ui/select.js";

afterEach(cleanup);

function makeFile(name: string): File {
  return new File(["x"], name, { type: "font/ttf" });
}

function getInput(container: HTMLElement): HTMLInputElement {
  const input = container.querySelector<HTMLInputElement>('input[type="file"]');
  if (input === null) throw new Error("render FileInput: no file input");
  return input;
}

function getPart(container: HTMLElement, slot: string): HTMLElement {
  const part = container.querySelector<HTMLElement>(`[data-slot="${slot}"]`);
  if (part === null) throw new Error(`render FileInput: no ${slot}`);
  return part;
}

/** Picks the files on the native input, the way the browser's picker hands them over. */
function pick(input: HTMLInputElement, files: File[]): void {
  Object.defineProperty(input, "files", { configurable: true, value: files });
  fireEvent.change(input);
}

describe("FileInput", () => {
  it("shows the button and \"No file chosen\" in English by default", () => {
    const { container } = render(<FileInput onFilesSelected={() => undefined} />);

    expect([getPart(container, "file-input-button").textContent, getPart(container, "file-input-name").textContent]).toEqual(["Choose a file", "No file chosen"]);
    expect(getPart(container, "file-input-button").textContent).toBe(notionMessages.en.fileInput.choose);
  });

  it("names the multiple-file button apart", () => {
    const { container } = render(<FileInput multiple onFilesSelected={() => undefined} />);

    expect(getPart(container, "file-input-button").textContent).toBe("Choose files");
    expect(getInput(container).multiple).toBe(true);
  });

  it("is labelled by its field label and passes accept, name and the invalid state to the native input", () => {
    render(
      <Field>
        <FieldLabel htmlFor="logo">Logo</FieldLabel>
        <FileInput id="logo" name="logo" accept=".svg,.png" aria-invalid aria-describedby="logo-hint" onFilesSelected={() => undefined} />
      </Field>,
    );
    const input = screen.getByLabelText<HTMLInputElement>("Logo");

    expect([input.type, input.accept, input.name, input.getAttribute("aria-invalid"), input.getAttribute("aria-describedby")]).toEqual([
      "file",
      ".svg,.png",
      "logo",
      "true",
      "logo-name logo-hint",
    ]);
  });

  it("hands the picked file over, shows its name and clears the input", () => {
    const onFilesSelected = vi.fn();
    const { container } = render(<FileInput onFilesSelected={onFilesSelected} />);
    const input = getInput(container);
    const file = makeFile("brand.ttf");
    pick(input, [file]);

    expect(onFilesSelected).toHaveBeenCalledWith([file]);
    expect(getPart(container, "file-input-name").textContent).toBe("brand.ttf");
    expect(getPart(container, "file-input-name").getAttribute("title")).toBe("brand.ttf");
    expect(input.value).toBe("");
  });

  it("counts several picked files in English by default", () => {
    const { container } = render(<FileInput multiple onFilesSelected={() => undefined} />);
    pick(getInput(container), [makeFile("a.ttf"), makeFile("b.ttf")]);

    expect(getPart(container, "file-input-name").textContent).toBe("2 files");
  });

  it("counts several picked files in the app's words", () => {
    const { container } = render(<FileInput multiple onFilesSelected={() => undefined} messages={{ count: "Files picked: {count}" }} />);
    pick(getInput(container), [makeFile("a.ttf"), makeFile("b.ttf")]);

    expect(getPart(container, "file-input-name").textContent).toBe("Files picked: 2");
  });

  it("ignores a change with no files", () => {
    const onFilesSelected = vi.fn();
    const { container } = render(<FileInput onFilesSelected={onFilesSelected} />);
    pick(getInput(container), []);

    expect(onFilesSelected).not.toHaveBeenCalled();
    expect(getPart(container, "file-input-name").textContent).toBe("No file chosen");
  });

  it("shows the app's file name over what was picked, and \"none\" for null", () => {
    const { container, rerender } = render(<FileInput fileName="logo-blue.svg" onFilesSelected={() => undefined} />);
    pick(getInput(container), [makeFile("other.svg")]);

    expect(getPart(container, "file-input-name").textContent).toBe("logo-blue.svg");

    rerender(<FileInput fileName={null} messages={{ none: "Nothing picked yet" }} onFilesSelected={() => undefined} />);

    expect(getPart(container, "file-input-name").textContent).toBe("Nothing picked yet");
    expect(getPart(container, "file-input-name").hasAttribute("title")).toBe(false);
  });

  it("opens the native picker from the drawn button, unless disabled", () => {
    const { container, rerender } = render(<FileInput onFilesSelected={() => undefined} />);
    const click = vi.spyOn(getInput(container), "click");
    fireEvent.click(getPart(container, "file-input-button"));

    expect(click).toHaveBeenCalledTimes(1);

    rerender(<FileInput disabled onFilesSelected={() => undefined} />);
    fireEvent.click(getPart(container, "file-input-button"));

    expect(click).toHaveBeenCalledTimes(1);
    expect((getPart(container, "file-input-button") as HTMLButtonElement).disabled).toBe(true);
    expect([getInput(container).disabled, getPart(container, "file-input").getAttribute("data-disabled")]).toEqual([true, "true"]);
  });

  it("keeps the native input focusable and hides the drawn button from assistive technology", () => {
    const { container } = render(<FileInput onFilesSelected={() => undefined} />);
    const input = getInput(container);
    input.focus();

    expect(document.activeElement).toBe(input);
    expect(input.tabIndex).not.toBe(-1);
    expect([getPart(container, "file-input-button").getAttribute("aria-hidden"), getPart(container, "file-input-button").tabIndex]).toEqual(["true", -1]);
  });

  it("renders on the server with a generated id tying the input to its name", () => {
    const html = renderToString(<FileInput onFilesSelected={() => undefined} />);
    const id = /<input id="([^"]+)"/.exec(html)?.[1] ?? "";

    expect(id).not.toBe("");
    expect(html).toContain(`aria-describedby="${id}-name"`);
    expect(html).toContain(`id="${id}-name"`);
  });

  it("is as high as Input and the default SelectTrigger, so a form row lines up", () => {
    const { container } = render(
      <>
        <FileInput onFilesSelected={() => undefined} />
        <Input />
        <Select>
          <SelectTrigger />
        </Select>
      </>,
    );
    const heights = ["file-input", "file-input-button", "input", "select-trigger"].map((slot) =>
      getPart(container, slot)
        .className.split(" ")
        .find((name) => /^(data-\[size=default\]:)?h-\d/.test(name)),
    );

    expect(heights).toEqual(["h-7", "h-7", "h-7", "data-[size=default]:h-7"]);
  });
});
