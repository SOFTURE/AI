// The PDF engine's worker module, imported only to run its message handler on the page's main thread.
declare module "pdfjs-dist/legacy/build/pdf.worker.min.mjs" {
  export const WorkerMessageHandler: unknown;
}
