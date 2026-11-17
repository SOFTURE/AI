"use client";

import { Check, Copy } from "lucide-react";
import { useEffect, useRef, useState, type ComponentProps } from "react";

import { cn } from "../lib/utils.js";
import { en as messages } from "../messages/en.js";
import { Button } from "../ui/button.js";

import { ICON_STROKE_WIDTH } from "./icon-stroke.js";

/** How long the button says "Copied" before it goes back to "Copy". */
export const COPY_BUTTON_RESET_MS = 2000;

export interface CopyButtonProps extends Omit<ComponentProps<typeof Button>, "onClick" | "children" | "asChild" | "value"> {
  /** The text written to the clipboard. */
  readonly value: string;
  /** The button's text before a copy; the English default is "Copy". */
  readonly label?: string;
  /** The button's text for a moment after a copy; the English default is "Copied". */
  readonly copiedLabel?: string;
  /** Told after the value reached the clipboard (e.g. to count a funnel step). */
  readonly onCopied?: () => void;
}

// One value to the clipboard: a secondary button with a copy icon that turns into a tick and says "Copied" for two
// seconds once the browser took the text, announced politely to a screen reader. A refused write (an insecure page, a
// denied permission) leaves the button as it was, so the value next to it can still be selected by hand. The copy is the
// app's (`label`, `copiedLabel`); the value is never part of the button's name.
export function CopyButton({
  value,
  label = messages.copy.copy,
  copiedLabel = messages.copy.copied,
  onCopied,
  variant = "secondary",
  className,
  type = "button",
  ...props
}: CopyButtonProps) {
  const [isCopied, setIsCopied] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (timer.current !== null) clearTimeout(timer.current);
    },
    [],
  );

  const copy = () => {
    // A page outside a secure context has no clipboard; the button then does nothing visible.
    const clipboard = typeof navigator === "undefined" ? undefined : navigator.clipboard;
    if (clipboard === undefined) return;
    clipboard.writeText(value).then(
      () => {
        setIsCopied(true);
        onCopied?.();
        if (timer.current !== null) clearTimeout(timer.current);
        timer.current = setTimeout(() => setIsCopied(false), COPY_BUTTON_RESET_MS);
      },
      () => setIsCopied(false),
    );
  };

  const Icon = isCopied ? Check : Copy;
  return (
    <Button
      data-slot="copy-button"
      data-copied={isCopied ? "" : undefined}
      type={type}
      variant={variant}
      className={cn("shrink-0", className)}
      onClick={copy}
      {...props}
    >
      <Icon aria-hidden="true" strokeWidth={ICON_STROKE_WIDTH} />
      <span aria-live="polite">{isCopied ? copiedLabel : label}</span>
    </Button>
  );
}
