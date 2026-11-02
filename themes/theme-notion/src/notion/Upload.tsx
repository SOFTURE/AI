"use client";

import { CircleAlert, CircleCheck, Clock, File as FileIcon, Pause, Play, RotateCw, Upload as UploadIcon, X, type LucideIcon } from "lucide-react";
import { useId, useRef, useState, type DragEvent, type ReactNode } from "react";

import { en } from "../messages/en.js";
import { cn } from "../lib/utils.js";
import { Button } from "../ui/button.js";
import { Field, FieldDescription, FieldError, FieldLabel } from "../ui/field.js";
import { Progress } from "../ui/progress.js";

import { ICON_STROKE_WIDTH } from "./icon-stroke.js";
import type { PaletteColor } from "./palette.js";
import { Status } from "./Status.js";

export type UploadState = "queued" | "uploading" | "paused" | "done" | "failed";

/** One file of an upload, as the app or its transport (e.g. `@softure-ai/files`) tracks it. */
export interface UploadFileItem {
  // Kept on the row as `data-upload`.
  readonly id: string;
  readonly name: string;
  // In bytes.
  readonly size: number;
  readonly state: UploadState;
  // 0–100, drawn while uploading or paused; clamped, and a non-finite value reads as 0.
  readonly progress?: number;
  // Why the upload failed, shown under a failed row.
  readonly error?: string;
}

/** The texts of the upload parts; `{name}` stands for the file's name. Built-in English: `notionMessages.en.upload`. */
export interface UploadMessages {
  readonly choose: string;
  readonly chooseOne: string;
  readonly drop: string;
  readonly dropOne: string;
  readonly dropping: string;
  readonly retry: string;
  readonly pause: string;
  readonly resume: string;
  readonly remove: string;
  readonly progress: string;
  // Each state's word, e.g. `failed`.
  readonly queued: string;
  readonly uploading: string;
  readonly paused: string;
  readonly done: string;
  readonly failed: string;
}

/** The app's wording for the upload parts; each text left out keeps the built-in English one. */
export type UploadMessagesOverride = Partial<UploadMessages>;

const SIZE_UNITS = ["kilobyte", "megabyte", "gigabyte", "terabyte"] as const;

/** A file size for people, in decimal steps (1 kB = 1000 bytes), written by the locale: `formatFileSize(1500)` is "1.5 kB". */
export function formatFileSize(bytes: number, locale = "en"): string {
  const size = Number.isFinite(bytes) ? Math.max(0, bytes) : 0;
  // Bytes in full ("820 bytes"): the short form of the unit is the bare word "byte" in English.
  if (size < 1000) return new Intl.NumberFormat(locale, { style: "unit", unit: "byte", unitDisplay: "long" }).format(Math.round(size));
  let value = size / 1000;
  let unit = 0;
  while (value >= 1000 && unit < SIZE_UNITS.length - 1) {
    value /= 1000;
    unit += 1;
  }
  return new Intl.NumberFormat(locale, { style: "unit", unit: SIZE_UNITS[unit], unitDisplay: "short", maximumFractionDigits: 1 }).format(value);
}

function mergeMessages(override: UploadMessagesOverride | undefined): UploadMessages {
  return { ...en.upload, ...override };
}

function fillName(template: string, name: string): string {
  return template.replaceAll("{name}", name);
}

/** Whether a file matches an `accept` list (".pdf", "video/*", "image/png"), the way the browser's picker reads it. */
function isAccepted(file: File, accept: string | undefined): boolean {
  if (accept === undefined || accept.trim() === "") return true;
  const name = file.name.toLowerCase();
  const type = file.type.toLowerCase();
  return accept
    .split(",")
    .map((entry) => entry.trim().toLowerCase())
    .filter((entry) => entry !== "")
    .some((entry) => {
      if (entry.startsWith(".")) return name.endsWith(entry);
      if (entry.endsWith("/*")) return type.startsWith(entry.slice(0, -1));
      return type === entry;
    });
}

export interface UploadFieldProps {
  // The field's visible label.
  readonly label: ReactNode;
  readonly description?: ReactNode;
  // A message under the area, e.g. "Choose at least one file"; marks the field invalid.
  readonly error?: ReactNode;
  // Passed to the native file input: file types, several files, the camera on a phone.
  readonly accept?: string;
  readonly multiple?: boolean;
  readonly capture?: "user" | "environment";
  readonly disabled?: boolean;
  // The files picked or dropped (those matching `accept`; only the first without `multiple`).
  readonly onFilesSelected: (files: File[]) => void;
  // Dropped files that do not match `accept`; the picker never offers them.
  readonly onFilesRejected?: (files: File[]) => void;
  readonly messages?: UploadMessagesOverride;
  // The native input's id; generated when left out.
  readonly id?: string;
  readonly className?: string;
}

// A labelled area to add files: a touch-sized button opens the native picker (so a phone offers its files, photos and
// camera), and on a wide screen files can also be dropped on the area. It holds no files of its own: it hands each pick
// or drop to `onFilesSelected`, and the app or its transport keeps the list (`UploadList`).
export function UploadField({
  label,
  description,
  error,
  accept,
  multiple = false,
  capture,
  disabled = false,
  onFilesSelected,
  onFilesRejected,
  messages,
  id,
  className,
}: UploadFieldProps) {
  const words = mergeMessages(messages);
  const generatedId = useId();
  const inputId = id ?? generatedId;
  const descriptionId = `${inputId}-description`;
  const errorId = `${inputId}-error`;
  const inputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const isInvalid = error !== undefined && error !== null && error !== false;
  const describedBy = [description === undefined ? undefined : descriptionId, isInvalid ? errorId : undefined].filter(Boolean).join(" ") || undefined;

  const handOver = (files: File[]) => {
    const accepted = files.filter((file) => isAccepted(file, accept));
    const rejected = files.filter((file) => !isAccepted(file, accept));
    const selected = multiple ? accepted : accepted.slice(0, 1);
    if (selected.length > 0) onFilesSelected(selected);
    if (rejected.length > 0) onFilesRejected?.(rejected);
  };

  const handleDragOver = (event: DragEvent<HTMLDivElement>) => {
    if (disabled) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = "copy";
    setIsDragging(true);
  };

  const handleDragLeave = (event: DragEvent<HTMLDivElement>) => {
    // Moving onto a child fires a leave on the area too; only leaving the area itself ends the highlight.
    if (event.relatedTarget instanceof Node && event.currentTarget.contains(event.relatedTarget)) return;
    setIsDragging(false);
  };

  const handleDrop = (event: DragEvent<HTMLDivElement>) => {
    if (disabled) return;
    event.preventDefault();
    setIsDragging(false);
    handOver(Array.from(event.dataTransfer.files));
  };

  return (
    <Field data-slot="upload-field" data-invalid={isInvalid || undefined} data-disabled={disabled || undefined} className={className}>
      <FieldLabel htmlFor={inputId}>{label}</FieldLabel>
      <div
        data-slot="upload-drop-area"
        data-dragging={isDragging || undefined}
        onDragOver={handleDragOver}
        onDragEnter={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={cn(
          "flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-input p-4 text-center text-sm text-muted-foreground transition-colors duration-120",
          "md:flex-row md:gap-3",
          "data-[dragging=true]:border-primary data-[dragging=true]:bg-blue-bg",
          "group-data-[invalid=true]/field:border-destructive group-data-[disabled=true]/field:opacity-50",
        )}
      >
        <UploadIcon aria-hidden="true" strokeWidth={ICON_STROKE_WIDTH} className="hidden size-5 shrink-0 md:block" />
        <Button
          type="button"
          variant="outline"
          size="touch"
          className="md:h-7"
          disabled={disabled}
          aria-describedby={describedBy}
          onClick={() => inputRef.current?.click()}
        >
          <UploadIcon aria-hidden="true" strokeWidth={ICON_STROKE_WIDTH} className="md:hidden" />
          {multiple ? words.choose : words.chooseOne}
        </Button>
        {/* A phone has nothing to drop, so the hint shows on a wide screen only. */}
        <span data-slot="upload-drop-hint" aria-hidden="true" className="hidden md:inline">
          {isDragging ? words.dropping : multiple ? words.drop : words.dropOne}
        </span>
        <input
          ref={inputRef}
          id={inputId}
          type="file"
          accept={accept}
          multiple={multiple}
          capture={capture}
          disabled={disabled}
          tabIndex={-1}
          aria-describedby={describedBy}
          aria-invalid={isInvalid || undefined}
          className="sr-only"
          onChange={(event) => {
            handOver(Array.from(event.currentTarget.files ?? []));
            // Cleared, so picking the same file again after removing it is a change too.
            event.currentTarget.value = "";
          }}
        />
      </div>
      {description === undefined ? null : <FieldDescription id={descriptionId}>{description}</FieldDescription>}
      {isInvalid ? <FieldError id={errorId}>{error}</FieldError> : null}
    </Field>
  );
}

export interface UploadListProps {
  // The list's accessible name, e.g. "Files".
  readonly label: string;
  // `UploadItem` rows.
  readonly children: ReactNode;
  readonly className?: string;
}

// The files of an upload, one `UploadItem` per row.
export function UploadList({ label, children, className }: UploadListProps) {
  return (
    <ul aria-label={label} data-slot="upload-list" className={cn("flex flex-col gap-1", className)}>
      {children}
    </ul>
  );
}

const STATE_STATUS: Readonly<Record<UploadState, { readonly color: PaletteColor; readonly icon: LucideIcon }>> = {
  queued: { color: "gray", icon: Clock },
  uploading: { color: "blue", icon: UploadIcon },
  paused: { color: "orange", icon: Pause },
  done: { color: "green", icon: CircleCheck },
  failed: { color: "red", icon: CircleAlert },
};

function clampProgress(value: number | undefined): number {
  if (value === undefined || !Number.isFinite(value)) return 0;
  return Math.min(100, Math.max(0, value));
}

export interface UploadItemProps {
  readonly item: UploadFileItem;
  // Each button shows only with its callback: Retry on a failed row, Pause while uploading, Resume when paused.
  readonly onRetry?: (item: UploadFileItem) => void;
  readonly onPause?: (item: UploadFileItem) => void;
  readonly onResume?: (item: UploadFileItem) => void;
  readonly onRemove?: (item: UploadFileItem) => void;
  // Formats the size, e.g. "de" writes "1,5 kB".
  readonly locale?: string;
  readonly messages?: UploadMessagesOverride;
  readonly className?: string;
}

// One file of an upload: its name, size and state word, a progress bar while it uploads or waits paused, the reason and
// a Retry button when it failed, and a Remove button. The buttons are touch sized on a phone.
export function UploadItem({ item, onRetry, onPause, onResume, onRemove, locale = "en", messages, className }: UploadItemProps) {
  const words = mergeMessages(messages);
  const errorId = `${useId()}-error`;
  const status = STATE_STATUS[item.state];
  const hasProgress = item.state === "uploading" || item.state === "paused";
  const hasError = item.state === "failed" && item.error !== undefined && item.error !== "";
  return (
    <li
      data-slot="upload-item"
      data-upload={item.id}
      data-state={item.state}
      className={cn("flex min-w-0 items-start gap-2 rounded-md px-2 py-1.5", className)}
    >
      <FileIcon aria-hidden="true" strokeWidth={ICON_STROKE_WIDTH} className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <div className="flex min-w-0 flex-wrap items-center gap-x-2">
          <span data-slot="upload-item-name" title={item.name} className="min-w-0 truncate text-sm font-medium">
            {item.name}
          </span>
          <span data-slot="upload-item-size" className="shrink-0 text-small text-muted-foreground tabular-nums">
            {formatFileSize(item.size, locale)}
          </span>
          <Status color={status.color} icon={status.icon} className="shrink-0 text-small">
            {words[item.state]}
          </Status>
        </div>
        {hasProgress ? (
          <Progress
            value={clampProgress(item.progress)}
            aria-label={fillName(words.progress, item.name)}
            indicatorClassName={item.state === "paused" ? "bg-orange" : undefined}
          />
        ) : null}
        {hasError ? (
          <p id={errorId} data-slot="upload-item-error" className="text-small text-destructive">
            {item.error}
          </p>
        ) : null}
      </div>
      <div data-slot="upload-item-actions" className="flex shrink-0 items-center gap-1">
        {item.state === "failed" && onRetry !== undefined ? (
          <Button type="button" variant="outline" size="touch" className="md:h-7" aria-describedby={hasError ? errorId : undefined} onClick={() => onRetry(item)}>
            <RotateCw aria-hidden="true" strokeWidth={ICON_STROKE_WIDTH} />
            {words.retry}
          </Button>
        ) : null}
        {item.state === "uploading" && onPause !== undefined ? (
          <ItemIconButton icon={Pause} label={fillName(words.pause, item.name)} onClick={() => onPause(item)} />
        ) : null}
        {item.state === "paused" && onResume !== undefined ? (
          <ItemIconButton icon={Play} label={fillName(words.resume, item.name)} onClick={() => onResume(item)} />
        ) : null}
        {onRemove === undefined ? null : <ItemIconButton icon={X} label={fillName(words.remove, item.name)} onClick={() => onRemove(item)} />}
      </div>
    </li>
  );
}

function ItemIconButton({ icon: Icon, label, onClick }: { readonly icon: LucideIcon; readonly label: string; readonly onClick: () => void }) {
  return (
    <Button type="button" variant="ghost" size="icon-touch" className="text-muted-foreground md:size-7" aria-label={label} title={label} onClick={onClick}>
      <Icon aria-hidden="true" strokeWidth={ICON_STROKE_WIDTH} />
    </Button>
  );
}
