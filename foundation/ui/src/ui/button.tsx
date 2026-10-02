import type { AnchorHTMLAttributes, ButtonHTMLAttributes, ComponentType, ReactNode } from "react";
import { type ClassNames, createSlotClassGetter } from "./class-names.js";

// Server-safe: no hooks, no "use client". Ported from FIRE_TRACKER src/components/button.tsx.

export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";
export type ButtonSize = "sm" | "md" | "lg";
export type ButtonSlot = "root" | "spinner";

// Height comes from one fixed `h-*` per size, never from vertical padding, so a button, a field and
// a select in one row line up whatever the font. Icons are sized by the button (`[&>svg]`).
// No preflight is assumed (the app may not use Tailwind): every button sets its own box, margin,
// border and background, and links lose their underline.
const BASE =
  "sft:m-0 sft:box-border sft:inline-flex sft:shrink-0 sft:cursor-pointer sft:no-underline sft:select-none sft:items-center sft:justify-center sft:font-sans sft:transition sft:duration-(--sft-duration-fast) sft:ease-(--sft-ease-out) sft:active:scale-97 sft:focus-visible:outline-2 sft:focus-visible:outline-offset-2 sft:focus-visible:outline-focus sft:disabled:cursor-not-allowed sft:disabled:opacity-50 sft:disabled:active:scale-100 sft:aria-busy:cursor-progress sft:[&>svg]:shrink-0";

const SIZE: Readonly<Record<ButtonSize, string>> = {
  sm: "sft:h-8 sft:gap-1.5 sft:rounded-control sft:px-3 sft:text-xs sft:[&>svg]:size-3.5",
  md: "sft:h-10 sft:gap-2 sft:rounded-control sft:px-4 sft:text-sm sft:[&>svg]:size-4",
  lg: "sft:h-12 sft:gap-2.5 sft:rounded-card sft:px-6 sft:text-base sft:[&>svg]:size-4.5",
};

const VARIANT: Readonly<Record<ButtonVariant, string>> = {
  primary: "sft:border sft:border-transparent sft:bg-accent-fill sft:font-semibold sft:text-on-accent sft:not-disabled:hover:bg-accent-fill-hover",
  secondary:
    "sft:border sft:border-border-strong sft:bg-transparent sft:font-medium sft:text-foreground sft:not-disabled:hover:border-foreground sft:not-disabled:hover:bg-foreground/5",
  ghost:
    "sft:border sft:border-transparent sft:bg-transparent sft:font-medium sft:text-muted sft:not-disabled:hover:bg-foreground/5 sft:not-disabled:hover:text-foreground",
  danger:
    "sft:border sft:border-danger/40 sft:bg-danger/10 sft:font-medium sft:text-danger sft:not-disabled:hover:border-danger sft:not-disabled:hover:bg-danger sft:not-disabled:hover:text-background",
};

const WIDTH = { full: "sft:w-full", auto: "" } as const;
const WRAP = { wrap: "sft:max-w-full sft:whitespace-normal sft:text-center", nowrap: "sft:whitespace-nowrap" } as const;

const SPINNER = "sft:animate-spin sft:motion-reduce:animate-none";

/** What every button-looking element shares. */
export interface ButtonLookProps {
  readonly variant: ButtonVariant;
  readonly size?: ButtonSize;
  /** Decorative icon before the label (hidden from assistive technology by the icon itself). */
  readonly iconLeft?: ReactNode;
  readonly iconRight?: ReactNode;
  readonly fullWidth?: boolean;
  /** Let a long label wrap instead of keeping one line. */
  readonly wrap?: boolean;
  readonly classNames?: ClassNames<ButtonSlot>;
  /** Render structure and behaviour only; the app styles every slot. */
  readonly unstyled?: boolean;
}

/** The default classes of a button look; exported so an app can style its own element alike. */
export function getButtonClass({
  variant,
  size = "md",
  fullWidth = false,
  wrap = false,
}: Pick<ButtonLookProps, "variant" | "size" | "fullWidth" | "wrap">): string {
  return [BASE, SIZE[size], VARIANT[variant], WIDTH[fullWidth ? "full" : "auto"], WRAP[wrap ? "wrap" : "nowrap"]]
    .filter((part) => part !== "")
    .join(" ");
}

function getLookSlots(props: ButtonLookProps) {
  return createSlotClassGetter<ButtonSlot>({
    defaults: { root: getButtonClass(props), spinner: SPINNER },
    classNames: props.classNames,
    unstyled: props.unstyled,
  });
}

function Spinner({ className }: { className: string | undefined }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" focusable="false" className={className}>
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeOpacity="0.3" strokeWidth="3" />
      <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

export type ButtonProps = ButtonLookProps &
  Omit<ButtonHTMLAttributes<HTMLButtonElement>, "className"> & {
    /**
     * Work in progress: a spinner replaces `iconLeft`, the button is disabled and `aria-busy`. The
     * label stays, so the button keeps its width and its accessible name.
     */
    readonly pending?: boolean;
  };

/** A button. `type` defaults to `button`, so a button inside a form never submits by accident. */
export function Button({
  variant,
  size = "md",
  iconLeft,
  iconRight,
  fullWidth,
  wrap,
  classNames,
  unstyled,
  pending = false,
  disabled,
  type = "button",
  children,
  ...rest
}: ButtonProps) {
  const slot = getLookSlots({ variant, size, fullWidth, wrap, classNames, unstyled });
  return (
    <button
      {...rest}
      type={type}
      disabled={disabled === true || pending}
      aria-busy={pending || undefined}
      data-variant={variant}
      data-size={size}
      className={slot("root")}
    >
      {pending ? <Spinner className={slot("spinner")} /> : iconLeft}
      {children}
      {iconRight}
    </button>
  );
}

/** Props a `LinkComponent` receives: an anchor's attributes with a string `href`. */
export type LinkComponentProps = AnchorHTMLAttributes<HTMLAnchorElement> & { readonly href: string };

/** The app's link (for example Next's `Link`), injected so `ui/` never imports a framework. */
export type LinkComponentType = ComponentType<LinkComponentProps>;

export type ButtonLinkProps = ButtonLookProps &
  Omit<AnchorHTMLAttributes<HTMLAnchorElement>, "className" | "href"> & {
    readonly href: string;
    /** Renders the link; a plain `<a>` when omitted. */
    readonly LinkComponent?: LinkComponentType;
  };

/** A link that looks like a button, with the same size classes as `Button`. */
export function ButtonLink({
  variant,
  size = "md",
  iconLeft,
  iconRight,
  fullWidth,
  wrap,
  classNames,
  unstyled,
  LinkComponent,
  children,
  ...rest
}: ButtonLinkProps) {
  const slot = getLookSlots({ variant, size, fullWidth, wrap, classNames, unstyled });
  const content = (
    <>
      {iconLeft}
      {children}
      {iconRight}
    </>
  );
  const props = { ...rest, "data-variant": variant, "data-size": size, className: slot("root") };
  return LinkComponent === undefined ? <a {...props}>{content}</a> : <LinkComponent {...props}>{content}</LinkComponent>;
}

export type IconButtonTone = "neutral" | "danger";
export type IconButtonSize = "sm" | "md" | "lg";
export type IconButtonSlot = "root";

const ICON_BASE =
  "sft:m-0 sft:box-border sft:inline-flex sft:shrink-0 sft:cursor-pointer sft:bg-transparent sft:p-0 sft:items-center sft:justify-center sft:transition sft:duration-(--sft-duration-fast) sft:ease-(--sft-ease-out) sft:active:scale-94 sft:focus-visible:outline-2 sft:focus-visible:outline-offset-2 sft:focus-visible:outline-focus sft:disabled:cursor-not-allowed sft:disabled:opacity-50";

// sm and md share the 32 px target: sm is a row action with a smaller glyph, md stands alone.
const ICON_SIZE: Readonly<Record<IconButtonSize, string>> = {
  sm: "sft:size-8 sft:rounded-control sft:[&>svg]:size-3.5",
  md: "sft:size-8 sft:rounded-control sft:[&>svg]:size-4",
  lg: "sft:size-11 sft:rounded-control sft:[&>svg]:size-5",
};

const ICON_TONE: Readonly<Record<IconButtonTone, string>> = {
  neutral: "sft:text-muted sft:not-disabled:hover:bg-surface-raised sft:not-disabled:hover:text-foreground",
  danger: "sft:text-muted sft:not-disabled:hover:bg-danger/10 sft:not-disabled:hover:text-danger",
};

const ICON_BORDER = {
  bordered: "sft:border sft:border-border-strong sft:not-disabled:hover:border-foreground",
  plain: "sft:border sft:border-transparent",
} as const;

export type IconButtonProps = Omit<
  ButtonHTMLAttributes<HTMLButtonElement>,
  "className" | "title" | "aria-label" | "children"
> & {
  /** The accessible name; there is no visible text and no native tooltip. */
  readonly label: string;
  readonly tone?: IconButtonTone;
  readonly size?: IconButtonSize;
  readonly bordered?: boolean;
  readonly classNames?: ClassNames<IconButtonSlot>;
  readonly unstyled?: boolean;
  /** The icon. */
  readonly children: ReactNode;
};

/** A button with only an icon, named by `label`. */
export function IconButton({
  label,
  tone = "neutral",
  size = "sm",
  bordered = false,
  classNames,
  unstyled,
  type = "button",
  children,
  ...rest
}: IconButtonProps) {
  const root = [ICON_BASE, ICON_SIZE[size], ICON_TONE[tone], ICON_BORDER[bordered ? "bordered" : "plain"]]
    .filter((part) => part !== "")
    .join(" ");
  const slot = createSlotClassGetter<IconButtonSlot>({ defaults: { root }, classNames, unstyled });
  return (
    <button {...rest} type={type} aria-label={label} data-variant="icon" data-size={size} className={slot("root")}>
      {children}
    </button>
  );
}
