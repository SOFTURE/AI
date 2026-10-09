"use client";

import { useEffect, useRef, useState } from "react";
import { Button, type ButtonSize, type ButtonVariant, IconButton } from "./button.js";
import { type ClassNames, createSlotClassGetter } from "./class-names.js";
import { type CopyProps, getCopy } from "./copy.js";
import { CheckIcon, CopyIcon } from "./icons.js";
import { useUiLocale } from "./locale.js";

// Copies a value (a token, a link, a code) to the clipboard. The label turns to "Copied" for a moment,
// and a polite live region says the same. The clipboard API needs a secure context (HTTPS or
// localhost); without one, or when the browser refuses the write, the button says "Copy failed" and a
// read-only field with the value appears, focused and selected, so the user copies it by hand.

export type CopyOutcome = "copied" | "failed";
type CopyState = "idle" | CopyOutcome;

export type CopyButtonSlot = "root" | "button" | "status" | "fallback" | "fallbackInput" | "fallbackHint";

export interface CopyButtonProps extends CopyProps<"copyButton"> {
  /** What goes to the clipboard. */
  readonly value: string;
  /** The idle label; the package's "Copy" by default. */
  readonly label?: string;
  /** Renders an `IconButton` named by the current label. */
  readonly isIconOnly?: boolean;
  /** `secondary` by default. */
  readonly variant?: ButtonVariant;
  /** `sm` by default. */
  readonly size?: ButtonSize;
  /** How long "Copied" stays, in milliseconds. */
  readonly resetMs?: number;
  readonly onCopy?: (outcome: CopyOutcome) => void;
  readonly classNames?: ClassNames<CopyButtonSlot>;
  readonly unstyled?: boolean;
}

const DEFAULT_RESET_MS = 2000;

const DEFAULT_CLASSES: Readonly<Record<CopyButtonSlot, string>> = {
  root: "sft:inline-flex sft:flex-col sft:items-start sft:gap-2 sft:font-sans",
  button: "",
  status: "sft:sr-only",
  fallback: "sft:flex sft:w-full sft:flex-col sft:gap-1",
  fallbackInput:
    "sft:m-0 sft:box-border sft:h-10 sft:w-full sft:rounded-control sft:border sft:border-border-strong sft:bg-surface sft:px-3 sft:font-mono sft:text-sm sft:text-foreground sft:focus:border-focus sft:focus:outline-none sft:focus:ring-1 sft:focus:ring-focus",
  fallbackHint: "sft:m-0 sft:text-xs sft:text-muted",
};

/** Writes `value` to the clipboard; `false` when the clipboard is out of reach or refuses. */
export async function writeToClipboard(value: string): Promise<boolean> {
  if (typeof window === "undefined" || !window.isSecureContext || !("clipboard" in navigator)) return false;
  try {
    await navigator.clipboard.writeText(value);
    return true;
  } catch (error: unknown) {
    // A refused write (no permission, the document lost focus) falls back to copying by hand.
    console.warn("CopyButton: the clipboard refused the write", error);
    return false;
  }
}

/** A button that copies `value`, with a hand-copy fallback where the clipboard is out of reach. */
export function CopyButton({
  value,
  label,
  isIconOnly = false,
  variant = "secondary",
  size = "sm",
  resetMs = DEFAULT_RESET_MS,
  onCopy,
  classNames,
  unstyled,
  locale,
  messages,
}: CopyButtonProps) {
  const copy = getCopy("copyButton", { locale: useUiLocale(locale), messages });
  const [state, setState] = useState<CopyState>("idle");
  const [attempt, setAttempt] = useState(0);
  const fallbackRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (state !== "copied") return;
    const timer = setTimeout(() => setState("idle"), resetMs);
    return () => clearTimeout(timer);
  }, [state, attempt, resetMs]);

  useEffect(() => {
    if (state !== "failed") return;
    fallbackRef.current?.focus();
    fallbackRef.current?.select();
  }, [state, attempt]);

  async function handleClick() {
    const outcome: CopyOutcome = (await writeToClipboard(value)) ? "copied" : "failed";
    setState(outcome);
    setAttempt((current) => current + 1);
    onCopy?.(outcome);
  }

  const slot = createSlotClassGetter({ defaults: DEFAULT_CLASSES, classNames, unstyled });
  const currentLabel = state === "copied" ? copy.copied : state === "failed" ? copy.failed : (label ?? copy.copy);
  const icon = state === "copied" ? <CheckIcon /> : <CopyIcon />;
  const announcement = state === "idle" ? "" : currentLabel;

  return (
    <span className={slot("root")} data-copy-state={state}>
      {isIconOnly ? (
        <IconButton label={currentLabel} onClick={() => void handleClick()} classNames={{ root: slot("button") }} unstyled={unstyled}>
          {icon}
        </IconButton>
      ) : (
        <Button variant={variant} size={size} iconLeft={icon} onClick={() => void handleClick()} className={slot("button")} unstyled={unstyled}>
          {currentLabel}
        </Button>
      )}
      <span role="status" aria-live="polite" className={slot("status")}>
        {announcement}
      </span>
      {state === "failed" ? (
        <span className={slot("fallback")}>
          <input
            ref={fallbackRef}
            type="text"
            readOnly
            value={value}
            aria-label={copy.manualLabel}
            onFocus={(event) => event.currentTarget.select()}
            className={slot("fallbackInput")}
          />
          <span className={slot("fallbackHint")}>{copy.manualHint}</span>
        </span>
      ) : null}
    </span>
  );
}
