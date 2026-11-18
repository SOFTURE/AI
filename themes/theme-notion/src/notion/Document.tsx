"use client";

import { CircleCheck, File as FileIcon, FileImage, FileText, LoaderCircle, Minus, Plus, X, type LucideIcon } from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";

import { en } from "../messages/en.js";
import { cn } from "../lib/utils.js";
import { Button } from "../ui/button.js";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogTitle } from "../ui/dialog.js";

import { DOCUMENT_ZOOM_STEPS, getDocumentKind, type DocumentKind } from "./document-kind.js";
import { formatFileSize } from "./format-file-size.js";
import { ICON_STROKE_WIDTH } from "./icon-stroke.js";
import { loadPdfjsEngine, type PdfDocumentHandle, type PdfEngine } from "./pdf-engine.js";
import { Status } from "./Status.js";

/** What the viewer shows: the bytes at hand (a kept copy, offline) or a URL it fetches. */
export type DocumentSource = { readonly blob: Blob } | { readonly url: string };

/** The texts of the document parts; `{count}`, `{number}` and `{percent}` are filled in. Built-in English: `notionMessages.en.document`. */
export interface DocumentMessages {
  readonly close: string;
  readonly zoomIn: string;
  readonly zoomOut: string;
  readonly zoom: string;
  readonly pageCount: string;
  readonly pageCountOne: string;
  readonly page: string;
  readonly loading: string;
  readonly failed: string;
  readonly unsupported: string;
  readonly offline: string;
  /** Read by a screen reader before a row's title. */
  readonly open: string;
}

/** The app's wording for the document parts; each text left out keeps the built-in English one. */
export type DocumentMessagesOverride = Partial<DocumentMessages>;

function mergeMessages(override: DocumentMessagesOverride | undefined): DocumentMessages {
  return { ...en.document, ...override };
}

function fill(template: string, values: Readonly<Record<string, string | number>>): string {
  return template.replaceAll(/\{(\w+)\}/g, (match, key: string) => (key in values ? String(values[key]) : match));
}

const FIT_INDEX = 2;
/** The width a PDF page fits when the viewer cannot measure its area (a page rendered on the server, a test). */
const FALLBACK_WIDTH = 800;
/** The widest a page is drawn at 100 %: a printed page's width on a wide screen, so its lines stay readable. */
const MAX_FIT_WIDTH = 880;

/** Reads a URL's bytes as the signed-in user, the way the app's own page would. */
async function fetchDocument(url: string): Promise<Blob> {
  const response = await fetch(url, { credentials: "same-origin" });
  if (!response.ok) throw new Error(`DocumentViewer: fetching ${url} answered ${String(response.status)}`);
  return response.blob();
}

type Loaded =
  | { readonly state: "loading" }
  | { readonly state: "failed" }
  | { readonly state: "unsupported" }
  | { readonly state: "pdf"; readonly document: PdfDocumentHandle }
  | { readonly state: "image"; readonly url: string };

export interface DocumentViewerProps {
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  /** The document's title, shown on top and as the dialog's name. */
  readonly title: string;
  /** The media type; it decides between PDF pages and an image. */
  readonly contentType: string;
  /** The bytes or the URL; nothing loads while it is `null`. */
  readonly source: DocumentSource | null;
  /** The PDF engine; pdf.js loaded on first use by default. */
  readonly loadPdfEngine?: () => Promise<PdfEngine>;
  /** Reads a URL source; `fetch` with the page's cookies by default. */
  readonly fetchFile?: (url: string) => Promise<Blob>;
  /** Something beside the zoom, e.g. a download link. */
  readonly actions?: ReactNode;
  readonly messages?: DocumentMessagesOverride;
  readonly className?: string;
}

// A document inside the page, on the whole screen: a PDF's pages drawn one under the other, or an image, with the
// title, the page count, zoom and a close button. It never opens a new browser window, which an installed phone app
// cannot come back from offline; with a `Blob` source it needs no network at all.
export function DocumentViewer({ open, onOpenChange, title, contentType, source, loadPdfEngine = loadPdfjsEngine, fetchFile = fetchDocument, actions, messages, className }: DocumentViewerProps) {
  const words = mergeMessages(messages);
  const [loaded, setLoaded] = useState<Loaded>({ state: "loading" });
  const [zoomIndex, setZoomIndex] = useState(FIT_INDEX);
  const kind = getDocumentKind(contentType);

  useEffect(() => {
    if (!open || source === null) return undefined;
    if (kind === "other") {
      setLoaded({ state: "unsupported" });
      return undefined;
    }
    let isCurrent = true;
    let release = (): void => undefined;
    setLoaded({ state: "loading" });
    setZoomIndex(FIT_INDEX);
    void (async () => {
      try {
        const blob = "blob" in source ? source.blob : await fetchFile(source.url);
        if (kind === "image") {
          const url = URL.createObjectURL(blob);
          release = () => URL.revokeObjectURL(url);
          if (isCurrent) setLoaded({ state: "image", url });
          else release();
          return;
        }
        const engine = await loadPdfEngine();
        const document = await engine.open(await blob.arrayBuffer());
        release = () => document.destroy();
        if (isCurrent) setLoaded({ state: "pdf", document });
        else release();
      } catch {
        if (isCurrent) setLoaded({ state: "failed" });
      }
    })();
    return () => {
      isCurrent = false;
      release();
    };
  }, [open, source, kind, loadPdfEngine, fetchFile]);

  const zoom = DOCUMENT_ZOOM_STEPS[zoomIndex] ?? 1;
  const pageCount = loaded.state === "pdf" ? loaded.document.pageCount : null;
  const canZoom = loaded.state === "pdf" || loaded.state === "image";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        data-slot="document-viewer"
        showCloseButton={false}
        className={cn(
          "top-0 left-0 flex h-dvh max-w-none translate-x-0 translate-y-0 flex-col gap-0 rounded-none bg-background p-0 text-foreground sm:max-w-none",
          "pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]",
          className,
        )}
      >
        <div data-slot="document-viewer-header" className="flex min-w-0 items-center gap-2 border-b border-border py-1 pr-2 pl-4">
          <div className="flex min-w-0 flex-1 flex-col">
            <DialogTitle className="truncate text-base" title={title}>
              {title}
            </DialogTitle>
            <DialogDescription data-slot="document-viewer-pages" className="text-small">
              {pageCount === null ? "" : pageCount === 1 ? words.pageCountOne : fill(words.pageCount, { count: pageCount })}
            </DialogDescription>
          </div>
          {actions}
          {canZoom ? (
            <div data-slot="document-viewer-zoom" className="flex shrink-0 items-center gap-1">
              <Button type="button" variant="ghost" size="icon-touch" className="md:size-7" aria-label={words.zoomOut} title={words.zoomOut} disabled={zoomIndex === 0} onClick={() => setZoomIndex((index) => Math.max(0, index - 1))}>
                <Minus aria-hidden="true" strokeWidth={ICON_STROKE_WIDTH} />
              </Button>
              <span data-slot="document-viewer-zoom-level" aria-live="polite" className="w-12 text-center text-small text-muted-foreground tabular-nums">
                {fill(words.zoom, { percent: Math.round(zoom * 100) })}
              </span>
              <Button
                type="button"
                variant="ghost"
                size="icon-touch"
                className="md:size-7"
                aria-label={words.zoomIn}
                title={words.zoomIn}
                disabled={zoomIndex === DOCUMENT_ZOOM_STEPS.length - 1}
                onClick={() => setZoomIndex((index) => Math.min(DOCUMENT_ZOOM_STEPS.length - 1, index + 1))}
              >
                <Plus aria-hidden="true" strokeWidth={ICON_STROKE_WIDTH} />
              </Button>
            </div>
          ) : null}
          {/* In the header, below the safe area, where the dialog's own corner button would sit under a phone's notch. */}
          <DialogClose asChild>
            <Button type="button" variant="ghost" size="icon-touch" data-slot="document-viewer-close" aria-label={words.close} title={words.close} className="shrink-0">
              <X aria-hidden="true" strokeWidth={ICON_STROKE_WIDTH} />
            </Button>
          </DialogClose>
        </div>
        {/* Focusable, so the pages scroll with the keyboard too. */}
        <div data-slot="document-viewer-body" role="region" aria-label={title} tabIndex={0} className="min-h-0 flex-1 overflow-auto bg-muted outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:ring-inset">
          <DocumentBody loaded={loaded} zoom={zoom} title={title} words={words} />
        </div>
      </DialogContent>
    </Dialog>
  );
}

function DocumentBody({ loaded, zoom, title, words }: { readonly loaded: Loaded; readonly zoom: number; readonly title: string; readonly words: DocumentMessages }) {
  if (loaded.state === "loading") {
    return (
      <p role="status" data-slot="document-viewer-loading" className="flex h-full items-center justify-center gap-2 text-sm text-muted-foreground">
        <LoaderCircle aria-hidden="true" strokeWidth={ICON_STROKE_WIDTH} className="size-4 animate-spin" />
        {words.loading}
      </p>
    );
  }
  if (loaded.state === "failed" || loaded.state === "unsupported") {
    return (
      <p role="alert" data-slot="document-viewer-error" className="flex h-full items-center justify-center p-6 text-center text-sm text-muted-foreground">
        {loaded.state === "failed" ? words.failed : words.unsupported}
      </p>
    );
  }
  if (loaded.state === "image") {
    return (
      <div className="flex min-h-full items-start justify-center p-4">
        {/* An object URL of the bytes at hand: nothing for an image optimizer to fetch. */}
        <img data-slot="document-viewer-image" src={loaded.url} alt={title} className="h-auto max-w-none" style={{ width: `${String(zoom * 100)}%` }} />
      </div>
    );
  }
  return <PdfPages document={loaded.document} zoom={zoom} words={words} />;
}

function PdfPages({ document, zoom, words }: { readonly document: PdfDocumentHandle; readonly zoom: number; readonly words: DocumentMessages }) {
  const areaRef = useRef<HTMLDivElement>(null);
  const [areaWidth, setAreaWidth] = useState<number | null>(null);

  useEffect(() => {
    const area = areaRef.current;
    if (area === null) return undefined;
    // The width inside the area's padding: at 100 % a page fits the screen with its margin on both sides.
    const measure = (): void => {
      const style = globalThis.getComputedStyle(area);
      const inner = area.clientWidth - (Number.parseFloat(style.paddingLeft) || 0) - (Number.parseFloat(style.paddingRight) || 0);
      setAreaWidth(inner > 0 ? Math.min(inner, MAX_FIT_WIDTH) : FALLBACK_WIDTH);
    };
    measure();
    if (typeof ResizeObserver === "undefined") return undefined;
    const observer = new ResizeObserver(measure);
    observer.observe(area);
    return () => observer.disconnect();
  }, []);

  const pages = Array.from({ length: document.pageCount }, (_, index) => index + 1);
  return (
    <div ref={areaRef} data-slot="document-viewer-pages-area" className="flex flex-col items-center gap-3 p-4">
      {areaWidth === null
        ? null
        : pages.map((pageNumber) => (
            <PdfPage key={pageNumber} document={document} pageNumber={pageNumber} width={Math.round(areaWidth * zoom)} label={fill(words.page, { number: pageNumber, count: document.pageCount })} />
          ))}
    </div>
  );
}

function PdfPage({ document, pageNumber, width, label }: { readonly document: PdfDocumentHandle; readonly pageNumber: number; readonly width: number; readonly label: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [hasFailed, setHasFailed] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (canvas === null) return;
    document.renderPage(pageNumber, canvas, width).then(
      () => setHasFailed(false),
      () => setHasFailed(true),
    );
  }, [document, pageNumber, width]);

  return (
    <canvas
      ref={canvasRef}
      role="img"
      aria-label={label}
      data-slot="document-viewer-page"
      data-page={pageNumber}
      data-failed={hasFailed || undefined}
      className="max-w-none bg-background shadow-dialog"
    />
  );
}

const KIND_ICONS: Readonly<Record<DocumentKind, LucideIcon>> = { pdf: FileText, image: FileImage, other: FileIcon };

export interface DocumentListProps {
  /** The list's accessible name, e.g. "Documents". */
  readonly label: string;
  /** `DocumentRow` rows. */
  readonly children: ReactNode;
  readonly className?: string;
}

// The documents of an entry, one `DocumentRow` per row.
export function DocumentList({ label, children, className }: DocumentListProps) {
  return (
    <ul aria-label={label} data-slot="document-list" className={cn("flex flex-col gap-1", className)}>
      {children}
    </ul>
  );
}

export interface DocumentRowProps {
  readonly title: string;
  readonly contentType: string;
  /** In bytes. */
  readonly size: number;
  /** Whether a copy is kept on the device; draws the "available offline" mark. */
  readonly isOffline?: boolean;
  /** The document's facts, e.g. "Confirmation · from e-mail · added 18 Nov"; shown after the size and moved under the
   * title on a narrow row. */
  readonly details?: string;
  /** Opens the document, e.g. in `DocumentViewer`. */
  readonly onOpen: () => void;
  /** Buttons after the row, e.g. a menu to rename or remove; always shown whole, so facts go in `details`. */
  readonly actions?: ReactNode;
  /** Formats the size, e.g. "de" writes "1,5 kB". */
  readonly locale?: string;
  readonly messages?: DocumentMessagesOverride;
  readonly className?: string;
}

// One document: an icon by its type, the title as a touch-sized button that opens it, its size, its facts, and a mark
// when a copy is kept on the device.
export function DocumentRow({ title, contentType, size, isOffline = false, details, onOpen, actions, locale = "en", messages, className }: DocumentRowProps) {
  const words = mergeMessages(messages);
  const kind = getDocumentKind(contentType);
  const Icon = KIND_ICONS[kind];
  return (
    <li data-slot="document-row" data-kind={kind} data-offline={isOffline || undefined} className={cn("flex min-w-0 items-center gap-2 rounded-md px-2 py-1", className)}>
      <Icon aria-hidden="true" strokeWidth={ICON_STROKE_WIDTH} className="size-4 shrink-0 text-muted-foreground" />
      <button
        type="button"
        data-slot="document-row-open"
        onClick={onOpen}
        className="flex min-h-touch-target min-w-0 flex-1 flex-wrap items-center gap-x-2 rounded-sm text-left outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 md:min-h-7"
      >
        {/* Read before the title, so the button's name is what it does and still holds every visible word. */}
        <span className="sr-only">{words.open} </span>
        <span data-slot="document-row-title" title={title} className="min-w-0 truncate text-sm font-medium">
          {title}
        </span>
        <span data-slot="document-row-size" className="shrink-0 text-small text-muted-foreground tabular-nums">
          {formatFileSize(size, locale)}
        </span>
        {details === undefined || details === "" ? null : (
          <span data-slot="document-row-details" className="min-w-0 text-small text-muted-foreground">
            {details}
          </span>
        )}
        {isOffline ? (
          <Status color="green" icon={CircleCheck} className="shrink-0 text-small">
            {words.offline}
          </Status>
        ) : null}
      </button>
      {actions === undefined ? null : <div data-slot="document-row-actions" className="flex shrink-0 items-center gap-1">{actions}</div>}
    </li>
  );
}
