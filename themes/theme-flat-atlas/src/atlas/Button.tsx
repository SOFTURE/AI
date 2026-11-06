import type { ButtonHTMLAttributes } from "react";

import { cn } from "../lib/utils.js";

import { getButtonLook, ICON_BUTTON_BORDERED_LOOK, ICON_BUTTON_LOOK, type ButtonSize, type ButtonVariant } from "./button-look.js";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /** Sets the height, padding and text size; `md` by default. */
  readonly size?: ButtonSize;
  /** Sets the colours; `secondary` by default, since `primary` is one per screen. */
  readonly variant?: ButtonVariant;
}

/** One button for the whole site: the size gives the dimensions, the variant only the colours. */
export function Button({ size = "md", variant = "secondary", type = "button", className, ...props }: ButtonProps) {
  return <button type={type} data-slot="button" data-variant={variant} className={cn(getButtonLook(size, variant), className)} {...props} />;
}

export interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /** The button's accessible name: the icon carries no text. */
  readonly "aria-label": string;
  /** Draws the `line-strong` outline, for a button that stands alone. */
  readonly isBordered?: boolean;
}

/** A 40 px button with only an icon inside; the name comes from `aria-label`. */
export function IconButton({ isBordered = false, type = "button", className, ...props }: IconButtonProps) {
  return <button type={type} data-slot="icon-button" className={cn(ICON_BUTTON_LOOK, isBordered && ICON_BUTTON_BORDERED_LOOK, className)} {...props} />;
}
