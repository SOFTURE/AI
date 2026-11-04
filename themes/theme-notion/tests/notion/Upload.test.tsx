// @vitest-environment happy-dom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { renderToString } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";

import { notionMessages } from "../../src/messages/index.js";
import { formatFileSize } from "../../src/notion/format-file-size.js";
import { UploadField, UploadItem, UploadList, type UploadFileItem } from "../../src/notion/Upload.js";

afterEach(cleanup);

function makeFile(name: string, type: string, size = 3): File {
  return new File(["x".repeat(size)], name, { type });
}

/** Fires a drop of the files on the area, the way a browser hands them over in `dataTransfer`. */
function dropFiles(area: Element, files: File[]): void {
  fireEvent.drop(area, { dataTransfer: { files, dropEffect: "none" } });
}

function getDropArea(container: HTMLElement): Element {
  const area = container.querySelector('[data-slot="upload-drop-area"]');
  if (area === null) throw new Error("render UploadField: no drop area");
  return area;
}

function getInput(container: HTMLElement): HTMLInputElement {
  const input = container.querySelector<HTMLInputElement>('input[type="file"]');
  if (input === null) throw new Error("render UploadField: no file input");
  return input;
}

describe("formatFileSize", () => {
  it("writes bytes in full below 1000 and decimal steps above", () => {
    expect([0, 999, 1000, 1500, 2_500_000, 3_210_000_000].map((bytes) => formatFileSize(bytes))).toEqual([
      "0 bytes",
      "999 bytes",
      "1 kB",
      "1.5 kB",
      "2.5 MB",
      "3.2 GB",
    ]);
  });

  it("formats by the locale", () => {
    expect(formatFileSize(1500, "de")).toBe(new Intl.NumberFormat("de", { style: "unit", unit: "kilobyte", unitDisplay: "short", maximumFractionDigits: 1 }).format(1.5));
    expect(formatFileSize(1500, "de")).toContain("1,5");
  });

  it("reads a negative or non-finite size as 0", () => {
    expect([formatFileSize(-5), formatFileSize(Number.NaN), formatFileSize(Number.POSITIVE_INFINITY)]).toEqual(["0 bytes", "0 bytes", "0 bytes"]);
  });
});

describe("UploadField", () => {
  it("labels the native input and opens it from a touch-sized button", () => {
    const { container } = render(<UploadField label="Videos" accept="video/*" multiple capture="environment" onFilesSelected={() => undefined} />);
    const input = screen.getByLabelText("Videos");
    const button = screen.getByRole("button", { name: "Choose files" });
    const click = vi.spyOn(input, "click");

    fireEvent.click(button);

    expect(input).toBe(getInput(container));
    expect([input.getAttribute("accept"), input.hasAttribute("multiple"), input.getAttribute("capture"), input.tabIndex]).toEqual(["video/*", true, "environment", -1]);
    expect(button.className.split(" ")).toEqual(expect.arrayContaining(["h-touch-target", "md:h-7"]));
    expect(click).toHaveBeenCalledOnce();
  });

  it("hands the picked files over and clears the input, so the same file can be picked again", () => {
    const onFilesSelected = vi.fn();
    const { container } = render(<UploadField label="Files" multiple onFilesSelected={onFilesSelected} />);
    const input = getInput(container);
    const files = [makeFile("a.pdf", "application/pdf"), makeFile("b.pdf", "application/pdf")];
    Object.defineProperty(input, "files", { value: files, configurable: true });

    fireEvent.change(input);

    expect(onFilesSelected).toHaveBeenCalledExactlyOnceWith(files);
    expect(input.value).toBe("");
  });

  it("names a single file in its copy without multiple", () => {
    const { container } = render(<UploadField label="Contract" onFilesSelected={() => undefined} />);

    expect(screen.getByRole("button", { name: "Choose a file" })).not.toBeNull();
    expect(container.querySelector('[data-slot="upload-drop-hint"]')?.textContent).toBe("or drop it here");
  });

  it("highlights the area while files are dragged over it and takes the dropped ones", () => {
    const onFilesSelected = vi.fn();
    const { container } = render(<UploadField label="Files" multiple onFilesSelected={onFilesSelected} />);
    const area = getDropArea(container);
    const files = [makeFile("a.mp4", "video/mp4"), makeFile("b.mp4", "video/mp4")];

    fireEvent.dragOver(area, { dataTransfer: { files: [], dropEffect: "none" } });
    const whileDragging = [area.getAttribute("data-dragging"), container.querySelector('[data-slot="upload-drop-hint"]')?.textContent];
    dropFiles(area, files);

    expect(whileDragging).toEqual(["true", "Drop to add"]);
    expect(area.getAttribute("data-dragging")).toBeNull();
    expect(onFilesSelected).toHaveBeenCalledExactlyOnceWith(files);
  });

  it("ends the highlight when the drag leaves the area", () => {
    const { container } = render(<UploadField label="Files" onFilesSelected={() => undefined} />);
    const area = getDropArea(container);

    fireEvent.dragEnter(area, { dataTransfer: { files: [], dropEffect: "none" } });
    fireEvent.dragLeave(area, { relatedTarget: document.body });

    expect(area.getAttribute("data-dragging")).toBeNull();
  });

  it("keeps the first dropped file only without multiple", () => {
    const onFilesSelected = vi.fn();
    const { container } = render(<UploadField label="File" onFilesSelected={onFilesSelected} />);
    const first = makeFile("a.pdf", "application/pdf");

    dropFiles(getDropArea(container), [first, makeFile("b.pdf", "application/pdf")]);

    expect(onFilesSelected).toHaveBeenCalledExactlyOnceWith([first]);
  });

  it("drops only the files that match accept and reports the rest as rejected", () => {
    const onFilesSelected = vi.fn();
    const onFilesRejected = vi.fn();
    const { container } = render(<UploadField label="Files" accept=".pdf, image/*" multiple onFilesSelected={onFilesSelected} onFilesRejected={onFilesRejected} />);
    const pdf = makeFile("Scan.PDF", "");
    const photo = makeFile("photo.heic", "image/heic");
    const video = makeFile("clip.mp4", "video/mp4");

    dropFiles(getDropArea(container), [pdf, video, photo]);

    expect(onFilesSelected).toHaveBeenCalledExactlyOnceWith([pdf, photo]);
    expect(onFilesRejected).toHaveBeenCalledExactlyOnceWith([video]);
  });

  it("matches an exact MIME type in accept", () => {
    const onFilesSelected = vi.fn();
    const onFilesRejected = vi.fn();
    const { container } = render(<UploadField label="Files" accept="image/png" multiple onFilesSelected={onFilesSelected} onFilesRejected={onFilesRejected} />);
    const png = makeFile("a.png", "image/png");
    const jpeg = makeFile("b.jpg", "image/jpeg");

    dropFiles(getDropArea(container), [png, jpeg]);

    expect([onFilesSelected.mock.calls, onFilesRejected.mock.calls]).toEqual([[[[png]]], [[[jpeg]]]]);
  });

  it("calls nothing when a drop holds no accepted file", () => {
    const onFilesSelected = vi.fn();
    const { container } = render(<UploadField label="Files" accept=".pdf" onFilesSelected={onFilesSelected} />);

    dropFiles(getDropArea(container), [makeFile("a.mp4", "video/mp4")]);

    expect(onFilesSelected).not.toHaveBeenCalled();
  });

  it("ignores drags and drops while disabled", () => {
    const onFilesSelected = vi.fn();
    const { container } = render(<UploadField label="Files" disabled onFilesSelected={onFilesSelected} />);
    const area = getDropArea(container);

    fireEvent.dragOver(area, { dataTransfer: { files: [], dropEffect: "none" } });
    const dragging = area.getAttribute("data-dragging");
    dropFiles(area, [makeFile("a.pdf", "application/pdf")]);

    expect([dragging, onFilesSelected.mock.calls.length]).toEqual([null, 0]);
    expect(screen.getByRole("button", { name: "Choose a file" }).hasAttribute("disabled")).toBe(true);
    expect(getInput(container).disabled).toBe(true);
  });

  it("describes the button and the input by the description and the error, and marks the field invalid", () => {
    const { container } = render(<UploadField id="videos" label="Videos" description="Up to 2 GB each" error="Choose at least one video" onFilesSelected={() => undefined} />);
    const button = screen.getByRole("button", { name: "Choose a file" });

    expect(button.getAttribute("aria-describedby")).toBe("videos-description videos-error");
    expect(getInput(container).getAttribute("aria-describedby")).toBe("videos-description videos-error");
    expect(getInput(container).getAttribute("aria-invalid")).toBe("true");
    expect(screen.getByRole("alert").textContent).toBe("Choose at least one video");
    expect(container.querySelector('[data-slot="upload-field"]')?.getAttribute("data-invalid")).toBe("true");
  });

  it("describes nothing without a description or an error", () => {
    render(<UploadField label="Files" onFilesSelected={() => undefined} />);

    expect(screen.getByRole("button", { name: "Choose a file" }).hasAttribute("aria-describedby")).toBe(false);
  });

  it("takes the app's wording", () => {
    const { container } = render(<UploadField label="Documents" multiple messages={{ choose: "Pick files", drop: "or let go of them here" }} onFilesSelected={() => undefined} />);

    expect(screen.getByRole("button", { name: "Pick files" })).not.toBeNull();
    expect(container.querySelector('[data-slot="upload-drop-hint"]')?.textContent).toBe("or let go of them here");
  });

  it("renders the same markup on the server", () => {
    const html = renderToString(<UploadField id="files" label="Files" onFilesSelected={() => undefined} />);

    expect(html).toContain('id="files"');
    expect(html).toContain('for="files"');
  });
});

const ITEM: UploadFileItem = { id: "f1", name: "holiday-video.mp4", size: 52_400_000, state: "uploading", progress: 40 };

describe("UploadList and UploadItem", () => {
  it("lists the files under the list's name", () => {
    render(
      <UploadList label="Files">
        <UploadItem item={ITEM} />
        <UploadItem item={{ ...ITEM, id: "f2", name: "notes.pdf", state: "done" }} />
      </UploadList>,
    );

    expect(screen.getByRole("list", { name: "Files" }).querySelectorAll("li").length).toBe(2);
  });

  it("shows the name, the size and the state word, and a named progress bar while uploading", () => {
    const { container } = render(<UploadItem item={ITEM} />);
    const row = container.querySelector('[data-slot="upload-item"]');

    expect([row?.getAttribute("data-upload"), row?.getAttribute("data-state")]).toEqual(["f1", "uploading"]);
    expect(container.querySelector('[data-slot="upload-item-name"]')?.getAttribute("title")).toBe("holiday-video.mp4");
    expect(container.querySelector('[data-slot="upload-item-size"]')?.textContent).toBe("52.4 MB");
    expect(container.querySelector('[data-slot="status"]')?.getAttribute("data-color")).toBe("blue");
    expect(container.querySelector('[data-slot="status-label"]')?.textContent).toBe("Uploading");
    expect(screen.getByRole("progressbar", { name: "Upload of holiday-video.mp4" }).getAttribute("aria-valuenow")).toBe("40");
  });

  it.each([
    ["queued", "gray", "Queued", false],
    ["uploading", "blue", "Uploading", true],
    ["paused", "orange", "Paused", true],
    ["done", "green", "Done", false],
    ["failed", "red", "Failed", false],
  ] as const)("draws %s in %s with the word %s (progress bar: %s)", (state, color, word, hasProgress) => {
    const { container } = render(<UploadItem item={{ ...ITEM, state }} />);

    expect([
      container.querySelector('[data-slot="status"]')?.getAttribute("data-color"),
      container.querySelector('[data-slot="status-label"]')?.textContent,
      screen.queryByRole("progressbar") !== null,
    ]).toEqual([color, word, hasProgress]);
  });

  it("fills a paused bar in orange", () => {
    const { container } = render(<UploadItem item={{ ...ITEM, state: "paused" }} />);

    expect(container.querySelector('[data-slot="progress-indicator"]')?.className.split(" ")).toContain("bg-orange");
  });

  it("clamps the progress and reads a missing or non-finite one as 0", () => {
    const values = [150, -10, Number.NaN, undefined].map((progress) => {
      const { unmount } = render(<UploadItem item={{ ...ITEM, progress }} />);
      const value = screen.getByRole("progressbar").getAttribute("aria-valuenow");
      unmount();
      return value;
    });

    expect(values).toEqual(["100", "0", "0", "0"]);
  });

  it("shows why a file failed and retries it with the item, the reason describing the button", () => {
    const onRetry = vi.fn();
    const failed: UploadFileItem = { ...ITEM, state: "failed", error: "The connection dropped." };
    const { container } = render(<UploadItem item={failed} onRetry={onRetry} />);
    const retry = screen.getByRole("button", { name: "Retry" });
    const error = container.querySelector('[data-slot="upload-item-error"]');

    fireEvent.click(retry);

    expect(error?.textContent).toBe("The connection dropped.");
    expect(retry.getAttribute("aria-describedby")).toBe(error?.id);
    expect(onRetry).toHaveBeenCalledExactlyOnceWith(failed);
  });

  it("offers Retry only on a failed row, and only with its callback", () => {
    const onRetry = vi.fn();
    render(<UploadItem item={ITEM} onRetry={onRetry} />);
    const onUploading = screen.queryByRole("button", { name: "Retry" });
    cleanup();
    render(<UploadItem item={{ ...ITEM, state: "failed" }} />);

    expect([onUploading, screen.queryByRole("button", { name: "Retry" })]).toEqual([null, null]);
  });

  it("draws a failed row without a reason and no description on Retry", () => {
    const { container } = render(<UploadItem item={{ ...ITEM, state: "failed" }} onRetry={() => undefined} />);

    expect(container.querySelector('[data-slot="upload-item-error"]')).toBeNull();
    expect(screen.getByRole("button", { name: "Retry" }).hasAttribute("aria-describedby")).toBe(false);
  });

  it("pauses an upload and resumes a paused one", () => {
    const onPause = vi.fn();
    const onResume = vi.fn();
    render(<UploadItem item={ITEM} onPause={onPause} onResume={onResume} />);
    fireEvent.click(screen.getByRole("button", { name: "Pause holiday-video.mp4" }));
    const resumeWhileUploading = screen.queryByRole("button", { name: "Resume holiday-video.mp4" });
    cleanup();
    const paused: UploadFileItem = { ...ITEM, state: "paused" };
    render(<UploadItem item={paused} onPause={onPause} onResume={onResume} />);
    fireEvent.click(screen.getByRole("button", { name: "Resume holiday-video.mp4" }));

    expect(resumeWhileUploading).toBeNull();
    expect(screen.queryByRole("button", { name: "Pause holiday-video.mp4" })).toBeNull();
    expect([onPause.mock.calls, onResume.mock.calls]).toEqual([[[ITEM]], [[paused]]]);
  });

  it("removes a file in any state with a touch-sized button named by the file", () => {
    const onRemove = vi.fn();
    render(<UploadItem item={{ ...ITEM, state: "done" }} onRemove={onRemove} />);
    const remove = screen.getByRole("button", { name: "Remove holiday-video.mp4" });

    fireEvent.click(remove);

    expect(remove.className.split(" ")).toEqual(expect.arrayContaining(["size-touch-target", "md:size-7"]));
    expect(onRemove).toHaveBeenCalledExactlyOnceWith({ ...ITEM, state: "done" });
  });

  it("draws no buttons without callbacks", () => {
    render(<UploadItem item={ITEM} />);

    expect(screen.queryAllByRole("button")).toEqual([]);
  });

  it("takes the app's wording and locale", () => {
    const { container } = render(
      <UploadItem
        item={{ ...ITEM, state: "paused" }}
        locale="de"
        messages={{ resume: "Continue {name}", progress: "Sending {name}", paused: "On hold" }}
        onResume={() => undefined}
      />,
    );

    expect(screen.getByRole("button", { name: "Continue holiday-video.mp4" })).not.toBeNull();
    expect(screen.getByRole("progressbar", { name: "Sending holiday-video.mp4" })).not.toBeNull();
    expect(container.querySelector('[data-slot="status-label"]')?.textContent).toBe("On hold");
    expect(container.querySelector('[data-slot="upload-item-size"]')?.textContent).toContain("52,4");
  });

  it("ships the English copy in notionMessages", () => {
    expect(notionMessages.en.upload).toMatchObject({ queued: "Queued", uploading: "Uploading", paused: "Paused", done: "Done", failed: "Failed" });
  });
});
