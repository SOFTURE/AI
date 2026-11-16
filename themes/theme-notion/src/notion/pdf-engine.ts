// The PDF engine of `DocumentViewer`: pdf.js (Apache-2.0) loaded on first use, its worker code run on the page's main
// thread (no worker URL to configure, and the chunks are ordinary build files a service worker keeps). Behind a small
// interface, so a test or an app can pass another engine.

/** An opened PDF: its page count, and each page drawn into a canvas at a CSS width. */
export interface PdfDocumentHandle {
  readonly pageCount: number;
  /** Draws page `pageNumber` (from 1) into `canvas`, `width` CSS pixels wide, sharp on the device's pixel ratio. */
  renderPage(pageNumber: number, canvas: HTMLCanvasElement, width: number): Promise<void>;
  /** Frees the document; a render after it fails. */
  destroy(): void;
}

export interface PdfEngine {
  /** Opens a PDF from its bytes; rejects for bytes that are not a PDF it can read. */
  open(data: ArrayBuffer): Promise<PdfDocumentHandle>;
}

interface PdfjsGlobal {
  pdfjsWorker?: unknown;
}

let loading: Promise<PdfEngine> | null = null;

/**
 * pdf.js as a `PdfEngine`, loaded once. The legacy build, so an older phone browser reads it too. Call it ahead (e.g.
 * when a page with documents opens) to fetch its chunks while online, so an installed app opens a PDF offline later.
 */
export function loadPdfjsEngine(): Promise<PdfEngine> {
  loading ??= importPdfjs().catch((error: unknown) => {
    loading = null;
    throw error;
  });
  return loading;
}

async function importPdfjs(): Promise<PdfEngine> {
  const [pdfjs, worker] = await Promise.all([import("pdfjs-dist/legacy/build/pdf.mjs"), import("pdfjs-dist/legacy/build/pdf.worker.min.mjs")]);
  const scope = globalThis as PdfjsGlobal;
  scope.pdfjsWorker ??= worker;
  return {
    async open(data) {
      const task = pdfjs.getDocument({ data: new Uint8Array(data.slice(0)), useSystemFonts: true });
      const document = await task.promise;
      return {
        pageCount: document.numPages,
        async renderPage(pageNumber, canvas, width) {
          const page = await document.getPage(pageNumber);
          const base = page.getViewport({ scale: 1 });
          const ratio = globalThis.devicePixelRatio > 0 ? globalThis.devicePixelRatio : 1;
          const viewport = page.getViewport({ scale: (width / base.width) * ratio });
          canvas.width = Math.floor(viewport.width);
          canvas.height = Math.floor(viewport.height);
          canvas.style.width = `${String(width)}px`;
          canvas.style.height = `${String(Math.floor(viewport.height / ratio))}px`;
          await page.render({ canvas, viewport }).promise;
        },
        destroy() {
          void task.destroy();
        },
      };
    },
  };
}
