"use client";

import { Upload as UploadIcon } from "lucide-react";
import { useId, useRef, useState, type ComponentProps } from "react";

import { en } from "../messages/en.js";
import { cn } from "../lib/utils.js";
import { buttonVariants } from "../ui/button.js";

import { ICON_STROKE_WIDTH } from "./icon-stroke.js";

/** The texts of the file input; `{count}` stands for the number of files picked. Built-in English: `notionMessages.en.fileInput`. */
export interface FileInputMessages {
  readonly choose: string;
  readonly chooseMany: string;
  readonly none: string;
  readonly count: string;
}

/** The app's wording for the file input; each text left out keeps the built-in English one. */
export type FileInputMessagesOverride = Partial<FileInputMessages>;

export interface FileInputProps {
  // The native input's id, for the field's `FieldLabel htmlFor`; generated when left out.
  readonly id?: string;
  readonly name?: string;
  // Passed to the native file input: file types, several files.
  readonly accept?: string;
  readonly multiple?: boolean;
  readonly disabled?: boolean;
  // The name shown beside the button, e.g. the file uploaded last; `null` shows "No file chosen". Left out, the input
  // shows the name of what was picked last.
  readonly fileName?: string | null;
  // The files picked; the input is cleared afterwards, so picking the same file again is a change too.
  readonly onFilesSelected: (files: File[]) => void;
  readonly messages?: FileInputMessagesOverride;
  readonly className?: string;
  readonly "aria-invalid"?: ComponentProps<"input">["aria-invalid"];
  readonly "aria-describedby"?: string;
}

/** What the input shows for a pick: the one file's name, or how many files. */
function describePick(files: readonly [File, ...File[]], words: FileInputMessages): string {
  return files.length === 1 ? files[0].name : words.count.replaceAll("{count}", String(files.length));
}

// A file picker for a form row: a button at the height of `Input` and `SelectTrigger` (28 px) and the chosen file's
// name beside it, in the app's language. The native input stays in the page, visually hidden: the field's label and
// the button open it, the keyboard focuses it (the button draws its focus ring), and it is what a test uploads to.
export function FileInput({
  id,
  name,
  accept,
  multiple = false,
  disabled = false,
  fileName,
  onFilesSelected,
  messages,
  className,
  "aria-invalid": ariaInvalid,
  "aria-describedby": ariaDescribedBy,
}: FileInputProps) {
  const words: FileInputMessages = { ...en.fileInput, ...messages };
  const generatedId = useId();
  const inputId = id ?? generatedId;
  const nameId = `${inputId}-name`;
  const inputRef = useRef<HTMLInputElement>(null);
  const [picked, setPicked] = useState<string | null>(null);
  const shown = fileName === undefined ? picked : fileName;

  return (
    <div data-slot="file-input" data-disabled={disabled || undefined} className={cn("flex h-7 min-w-0 items-center gap-2", className)}>
      <input
        ref={inputRef}
        id={inputId}
        name={name}
        type="file"
        accept={accept}
        multiple={multiple}
        disabled={disabled}
        aria-invalid={ariaInvalid}
        aria-describedby={[nameId, ariaDescribedBy].filter(Boolean).join(" ")}
        className="peer sr-only"
        onChange={(event) => {
          // A change always carries a FileList; an empty one is a cancelled pick.
          const files = Array.from(event.currentTarget.files as FileList);
          event.currentTarget.value = "";
          const [first, ...rest] = files;
          if (first === undefined) return;
          setPicked(describePick([first, ...rest], words));
          onFilesSelected(files);
        }}
      />
      {/* The visible button: the native input before it takes focus and keys, so this one is out of the tab order and
          hidden from assistive technology; a click on it opens the picker. */}
      <button
        type="button"
        tabIndex={-1}
        aria-hidden="true"
        disabled={disabled}
        data-slot="file-input-button"
        onClick={() => inputRef.current?.click()}
        className={cn(
          buttonVariants({ variant: "outline" }),
          "select-none",
          "peer-focus-visible:border-ring peer-focus-visible:ring-2 peer-focus-visible:ring-ring",
          "peer-aria-invalid:border-destructive",
        )}
      >
        <UploadIcon aria-hidden="true" strokeWidth={ICON_STROKE_WIDTH} />
        {multiple ? words.chooseMany : words.choose}
      </button>
      <span id={nameId} data-slot="file-input-name" title={shown ?? undefined} className={cn("min-w-0 truncate text-sm", shown === null ? "text-muted-foreground" : "text-foreground")}>
        {shown ?? words.none}
      </span>
    </div>
  );
}
