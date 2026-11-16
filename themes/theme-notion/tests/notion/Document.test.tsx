// @vitest-environment happy-dom
// DocumentViewer, DocumentList and DocumentRow (MR-344 of an adopting app, #1256): a PDF's pages and an image inside
// the page from a Blob (offline) or a URL, page count, zoom within its steps, close, a broken file and an unsupported
// type; the row's icon by type, size, offline mark and open button.
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";

import { notionMessages } from "../../src/messages/index.js";
import { DOCUMENT_ZOOM_STEPS, DocumentList, DocumentRow, DocumentViewer, getDocumentKind, type DocumentViewerProps } from "../../src/notion/Document.js";
import type { PdfEngine } from "../../src/notion/pdf-engine.js";
import { installDomShims } from "../gallery/dom.js";

beforeAll(installDomShims);
afterEach(cleanup);

const words = notionMessages.en.document;

interface FakeEngine extends PdfEngine {
  readonly opened: ArrayBuffer[];
  readonly renders: { page: number; width: number }[];
  destroyed: number;
}

function createEngine(pageCount: number, options: { failOpen?: boolean; failPage?: number } = {}): FakeEngine {
  const engine: FakeEngine = {
    opened: [],
    renders: [],
    destroyed: 0,
    open(data) {
      engine.opened.push(data);
      if (options.failOpen === true) return Promise.reject(new Error("Invalid PDF structure"));
      return Promise.resolve({
        pageCount,
        renderPage(page, _canvas, width) {
          engine.renders.push({ page, width });
          return page === options.failPage ? Promise.reject(new Error("render failed")) : Promise.resolve();
        },
        destroy() {
          engine.destroyed += 1;
        },
      });
    },
  };
  return engine;
}

function renderViewer(props: Partial<DocumentViewerProps> & { engine?: PdfEngine } = {}) {
  const { engine = createEngine(3), ...rest } = props;
  const onOpenChange = vi.fn();
  const view = render(
    <DocumentViewer
      open
      onOpenChange={onOpenChange}
      title="Fictional booking.pdf"
      contentType="application/pdf"
      source={{ blob: new Blob(["%PDF-1.7 fictional"], { type: "application/pdf" }) }}
      loadPdfEngine={() => Promise.resolve(engine)}
      {...rest}
    />,
  );
  return { ...view, onOpenChange };
}

function getPages(): HTMLCanvasElement[] {
  return [...document.querySelectorAll<HTMLCanvasElement>('[data-slot="document-viewer-page"]')];
}

describe("getDocumentKind (MR-344)", () => {
  it("MR-344 reads PDF, image and other media types, parameters and case ignored", () => {
    expect(["application/pdf", "Application/PDF; name=x", "image/png", "image/jpeg", "text/html", "", "application/octet-stream"].map(getDocumentKind)).toEqual([
      "pdf",
      "pdf",
      "image",
      "image",
      "other",
      "other",
      "other",
    ]);
  });
});

describe("DocumentViewer (MR-344)", () => {
  it("MR-344 shows every page of a three-page PDF from a Blob, with the page count, and no fetch", async () => {
    const engine = createEngine(3);
    const fetchFile = vi.fn();
    renderViewer({ engine, fetchFile });

    await waitFor(() => expect(getPages()).toHaveLength(3));
    expect(fetchFile).not.toHaveBeenCalled();
    expect(screen.getByRole("dialog", { name: "Fictional booking.pdf" })).toBeTruthy();
    expect(screen.getByRole("region", { name: "Fictional booking.pdf" }).tabIndex).toBe(0);
    expect(document.querySelector('[data-slot="document-viewer-pages"]')?.textContent).toBe("3 pages");
    expect(getPages().map((page) => [page.dataset["page"], page.getAttribute("aria-label")])).toEqual([
      ["1", "Page 1 of 3"],
      ["2", "Page 2 of 3"],
      ["3", "Page 3 of 3"],
    ]);
    await waitFor(() => expect(engine.renders.map(({ page }) => page)).toEqual([1, 2, 3]));
    expect(new TextDecoder().decode(engine.opened[0])).toBe("%PDF-1.7 fictional");
  });

  it("MR-344 writes one page in the singular, and the app's wording when given", async () => {
    renderViewer({ engine: createEngine(1) });
    await waitFor(() => expect(document.querySelector('[data-slot="document-viewer-pages"]')?.textContent).toBe(words.pageCountOne));
    cleanup();

    renderViewer({ engine: createEngine(2), messages: { pageCount: "{count} sheets", page: "Sheet {number} of {count}", pageCountOne: "1 sheet" } });
    await waitFor(() => expect(document.querySelector('[data-slot="document-viewer-pages"]')?.textContent).toBe("2 sheets"));
    await waitFor(() => expect(getPages()[1]?.getAttribute("aria-label")).toBe("Sheet 2 of 2"));
  });

  it("MR-344 zooms in and out by its steps, re-rendering the pages at the new width, and stops at both ends", async () => {
    const engine = createEngine(1);
    renderViewer({ engine });
    await waitFor(() => expect(engine.renders).toHaveLength(1));
    const fitted = engine.renders[0]?.width ?? 0;
    const zoomIn = screen.getByRole("button", { name: words.zoomIn });
    const zoomOut = screen.getByRole("button", { name: words.zoomOut });
    const level = () => document.querySelector('[data-slot="document-viewer-zoom-level"]')?.textContent;
    expect(level()).toBe("100%");

    fireEvent.click(zoomIn);
    await waitFor(() => expect(engine.renders.at(-1)?.width).toBe(Math.round(fitted * 1.25)));
    expect(level()).toBe("125%");
    for (let step = 0; step < DOCUMENT_ZOOM_STEPS.length; step += 1) fireEvent.click(zoomIn);
    expect([level(), (zoomIn as HTMLButtonElement).disabled]).toEqual(["300%", true]);
    for (let step = 0; step < DOCUMENT_ZOOM_STEPS.length; step += 1) fireEvent.click(zoomOut);
    expect([level(), (zoomOut as HTMLButtonElement).disabled]).toEqual(["50%", true]);
    await waitFor(() => expect(engine.renders.at(-1)?.width).toBe(Math.round(fitted * 0.5)));
  });

  it("MR-344 labels the zoom buttons and level with the app's wording", async () => {
    renderViewer({ messages: { zoomIn: "Larger", zoomOut: "Smaller", zoom: "{percent} percent" } });
    await waitFor(() => expect(screen.getByRole("button", { name: "Larger" })).toBeTruthy());
    expect(screen.getByRole("button", { name: "Smaller" })).toBeTruthy();
    expect(document.querySelector('[data-slot="document-viewer-zoom-level"]')?.textContent).toBe("100 percent");
    expect([words.zoomIn, words.zoomOut, words.zoom]).toEqual(["Zoom in", "Zoom out", "{percent}%"]);
  });

  it("MR-344 shows an image from a Blob as an object URL, with zoom, and revokes it on close", async () => {
    const created = vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:fictional-image");
    const revoked = vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => undefined);
    const view = renderViewer({ contentType: "image/png", title: "Boarding pass.png", source: { blob: new Blob(["png"], { type: "image/png" }) } });

    await waitFor(() => expect(document.querySelector('[data-slot="document-viewer-image"]')).not.toBeNull());
    const image = document.querySelector<HTMLImageElement>('[data-slot="document-viewer-image"]');
    expect([image?.getAttribute("src"), image?.getAttribute("alt"), image?.style.width]).toEqual(["blob:fictional-image", "Boarding pass.png", "100%"]);
    expect(document.querySelector('[data-slot="document-viewer-pages"]')?.textContent).toBe("");
    fireEvent.click(screen.getByRole("button", { name: words.zoomIn }));
    expect(image?.style.width).toBe("125%");

    view.rerender(<DocumentViewer open={false} onOpenChange={() => undefined} title="Boarding pass.png" contentType="image/png" source={null} />);
    expect(revoked).toHaveBeenCalledWith("blob:fictional-image");
    created.mockRestore();
    revoked.mockRestore();
  });

  it("MR-344 fetches a URL source, then shows it", async () => {
    const fetchFile = vi.fn(() => Promise.resolve(new Blob(["%PDF-1.7"], { type: "application/pdf" })));
    renderViewer({ source: { url: "/api/documents/d1" }, fetchFile, engine: createEngine(2) });

    await waitFor(() => expect(getPages()).toHaveLength(2));
    expect(fetchFile).toHaveBeenCalledWith("/api/documents/d1");
  });

  it("MR-344 opens a kept Blob offline: no fetch is made even when every fetch fails", async () => {
    const offlineFetch = vi.spyOn(globalThis, "fetch").mockRejectedValue(new TypeError("Failed to fetch"));
    renderViewer({ engine: createEngine(2) });

    await waitFor(() => expect(getPages()).toHaveLength(2));
    expect(offlineFetch).not.toHaveBeenCalled();
    offlineFetch.mockRestore();
  });

  it("MR-344 shows the failure for a URL that cannot be fetched offline", async () => {
    renderViewer({ source: { url: "/api/documents/d1" }, fetchFile: () => Promise.reject(new TypeError("Failed to fetch")) });

    await waitFor(() => expect(screen.getByRole("alert").textContent).toBe(words.failed));
  });

  it("MR-344 shows the failure for a broken PDF, and the app's wording when given", async () => {
    renderViewer({ engine: createEngine(0, { failOpen: true }) });
    await waitFor(() => expect(screen.getByRole("alert").textContent).toBe("This document cannot be shown."));
    expect(screen.queryByRole("button", { name: words.zoomIn })).toBeNull();
    cleanup();

    renderViewer({ engine: createEngine(0, { failOpen: true }), messages: { failed: "Cannot show it" } });
    await waitFor(() => expect(screen.getByRole("alert").textContent).toBe("Cannot show it"));
  });

  it("MR-344 shows the failure when the PDF engine cannot load", async () => {
    renderViewer({ loadPdfEngine: () => Promise.reject(new Error("chunk failed")) });

    await waitFor(() => expect(screen.getByRole("alert").textContent).toBe(words.failed));
  });

  it("MR-344 marks a page that fails to draw and keeps the others", async () => {
    renderViewer({ engine: createEngine(3, { failPage: 2 }) });

    await waitFor(() => expect(getPages().map((page) => page.dataset["failed"] ?? "")).toEqual(["", "true", ""]));
  });

  it("MR-344 tells an unsupported type at once and loads nothing", () => {
    const loadPdfEngine = vi.fn();
    renderViewer({ contentType: "text/html", loadPdfEngine });

    expect(screen.getByRole("alert").textContent).toBe(words.unsupported);
    expect(loadPdfEngine).not.toHaveBeenCalled();
  });

  it("MR-344 shows the loading state until the document is read", () => {
    renderViewer({ source: { url: "/slow" }, fetchFile: () => new Promise<Blob>(() => undefined) });

    expect(screen.getByRole("status").textContent).toBe(words.loading);
  });

  it("MR-344 loads nothing while closed or without a source", () => {
    const loadPdfEngine = vi.fn();
    render(<DocumentViewer open={false} onOpenChange={() => undefined} title="x" contentType="application/pdf" source={{ blob: new Blob([]) }} loadPdfEngine={loadPdfEngine} />);
    render(<DocumentViewer open onOpenChange={() => undefined} title="x" contentType="application/pdf" source={null} loadPdfEngine={loadPdfEngine} />);

    expect(loadPdfEngine).not.toHaveBeenCalled();
  });

  it("MR-344 closes with its button and with Escape, and frees the PDF", async () => {
    const engine = createEngine(1);
    const { onOpenChange, rerender } = renderViewer({ engine });
    await waitFor(() => expect(getPages()).toHaveLength(1));

    fireEvent.click(screen.getByRole("button", { name: words.close }));
    expect(onOpenChange).toHaveBeenLastCalledWith(false);
    fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });
    expect(onOpenChange).toHaveBeenCalledTimes(2);

    rerender(<DocumentViewer open={false} onOpenChange={onOpenChange} title="x" contentType="application/pdf" source={null} />);
    expect(engine.destroyed).toBe(1);
  });

  it("MR-344 drops a document that finishes loading after the viewer moved on", async () => {
    let finish: (blob: Blob) => void = () => undefined;
    const engine = createEngine(4);
    const view = renderViewer({ engine, source: { url: "/first" }, fetchFile: () => new Promise<Blob>((resolve) => (finish = resolve)) });
    view.rerender(<DocumentViewer open={false} onOpenChange={() => undefined} title="x" contentType="application/pdf" source={null} loadPdfEngine={() => Promise.resolve(engine)} />);

    await act(async () => {
      finish(new Blob(["%PDF"]));
      await Promise.resolve();
    });
    await waitFor(() => expect(engine.destroyed).toBe(engine.opened.length));
    expect(getPages()).toEqual([]);
  });

  it("MR-344 shows an action beside the zoom", async () => {
    renderViewer({ actions: <a href="/api/documents/d1">Download</a> });
    await waitFor(() => expect(screen.getByRole("link", { name: "Download" })).toBeTruthy());
  });
});

describe("DocumentList and DocumentRow (MR-344)", () => {
  it("MR-344 lists documents with an icon by type, the size and the offline mark", () => {
    render(
      <DocumentList label="Documents">
        <DocumentRow title="Hotel.pdf" contentType="application/pdf" size={182_000} isOffline onOpen={() => undefined} />
        <DocumentRow title="Pass.png" contentType="image/png" size={64_000} onOpen={() => undefined} />
        <DocumentRow title="Notes.txt" contentType="text/plain" size={900} onOpen={() => undefined} />
      </DocumentList>,
    );

    expect(screen.getByRole("list", { name: "Documents" })).toBeTruthy();
    const rows = [...document.querySelectorAll<HTMLElement>('[data-slot="document-row"]')];
    expect(
      rows.map((row) => [
        row.dataset["kind"],
        row.querySelector('[data-slot="document-row-title"]')?.textContent,
        row.querySelector('[data-slot="document-row-size"]')?.textContent,
        row.querySelector('[data-slot="status-label"]')?.textContent ?? null,
        row.querySelector("svg")?.getAttribute("class")?.includes("lucide-file-text") ?? false,
      ]),
    ).toEqual([
      ["pdf", "Hotel.pdf", "182 kB", "Available offline", true],
      ["image", "Pass.png", "64 kB", null, false],
      ["other", "Notes.txt", "900 bytes", null, false],
    ]);
    expect(rows[1]?.querySelector("svg")?.getAttribute("class")).toContain("lucide-file-image");
  });

  it("MR-344 opens the document from its touch-sized button, whose name holds every visible word", () => {
    const onOpen = vi.fn();
    render(<DocumentRow title="Hotel.pdf" contentType="application/pdf" size={1500} isOffline onOpen={onOpen} locale="de" messages={{ open: "View", offline: "Kept" }} />);
    const button = screen.getByRole("button");

    expect(button.textContent?.replace(/\s+/g, " ")).toBe("View Hotel.pdf1,5 kBKept");
    fireEvent.click(button);
    expect(onOpen).toHaveBeenCalledTimes(1);
    expect(button.className).toContain("min-h-touch-target");
  });

  it("MR-344 draws the row's actions after it, and none without them", () => {
    render(<DocumentRow title="A.pdf" contentType="application/pdf" size={1} onOpen={() => undefined} actions={<button type="button">Rename</button>} />);
    expect(screen.getByRole("button", { name: "Rename" }).parentElement?.dataset["slot"]).toBe("document-row-actions");
    cleanup();

    render(<DocumentRow title="A.pdf" contentType="application/pdf" size={1} onOpen={() => undefined} />);
    expect(document.querySelector('[data-slot="document-row-actions"]')).toBeNull();
  });
});
