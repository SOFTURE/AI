// Decorative icons on one frame: a 24 grid, a 2-unit stroke in `currentColor`, hidden from assistive
// technology. A control that shows only an icon carries its own name (`IconButton label`).
// Server-safe.
import type { ReactNode } from "react";

export interface IconProps {
  /** Width and height in px; a parent's CSS (a button's `[&>svg]:size-*`) wins over it. */
  readonly size?: number;
  readonly className?: string;
}

function IconFrame({ size = 16, className, children }: IconProps & { readonly children: ReactNode }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      className={className}
    >
      {children}
    </svg>
  );
}

export function ArrowLeftIcon(props: IconProps) {
  return (
    <IconFrame {...props}>
      <path d="M19 12H5" />
      <path d="m12 19-7-7 7-7" />
    </IconFrame>
  );
}

export function ArrowRightIcon(props: IconProps) {
  return (
    <IconFrame {...props}>
      <path d="M5 12h14" />
      <path d="m12 5 7 7-7 7" />
    </IconFrame>
  );
}

export function PlusIcon(props: IconProps) {
  return (
    <IconFrame {...props}>
      <path d="M12 5v14" />
      <path d="M5 12h14" />
    </IconFrame>
  );
}

export function CheckIcon(props: IconProps) {
  return (
    <IconFrame {...props}>
      <path d="M20 6 9 17l-5-5" />
    </IconFrame>
  );
}

export function CloseIcon(props: IconProps) {
  return (
    <IconFrame {...props}>
      <path d="M18 6 6 18" />
      <path d="m6 6 12 12" />
    </IconFrame>
  );
}

export function MailIcon(props: IconProps) {
  return (
    <IconFrame {...props}>
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="m3 7 9 6 9-6" />
    </IconFrame>
  );
}

export function MenuIcon(props: IconProps) {
  return (
    <IconFrame {...props}>
      <path d="M4 6h16" />
      <path d="M4 12h16" />
      <path d="M4 18h16" />
    </IconFrame>
  );
}

export function ChevronRightIcon(props: IconProps) {
  return (
    <IconFrame {...props}>
      <path d="m9 18 6-6-6-6" />
    </IconFrame>
  );
}

export function ChevronDownIcon(props: IconProps) {
  return (
    <IconFrame {...props}>
      <path d="m6 9 6 6 6-6" />
    </IconFrame>
  );
}

export function InfoIcon(props: IconProps) {
  return (
    <IconFrame {...props}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 16v-4" />
      <path d="M12 8h.01" />
    </IconFrame>
  );
}

export function ShieldIcon(props: IconProps) {
  return (
    <IconFrame {...props}>
      <path d="M12 3 5 6v5c0 4.5 3 8.2 7 10 4-1.8 7-5.5 7-10V6l-7-3Z" />
      <path d="m9 12 2 2 4-4" />
    </IconFrame>
  );
}

export function KeyIcon(props: IconProps) {
  return (
    <IconFrame {...props}>
      <circle cx="8" cy="15" r="4" />
      <path d="m10.8 12.2 8.7-8.7" />
      <path d="m16 7 2.5 2.5" />
      <path d="m18.5 4.5 2 2" />
    </IconFrame>
  );
}

export function ChartIcon(props: IconProps) {
  return (
    <IconFrame {...props}>
      <path d="M4 4v16h16" />
      <path d="m8 15 4-4 3 3 5-6" />
    </IconFrame>
  );
}

export function CalendarIcon(props: IconProps) {
  return (
    <IconFrame {...props}>
      <rect x="4" y="5" width="16" height="16" rx="2" />
      <path d="M16 3v4" />
      <path d="M8 3v4" />
      <path d="M4 10h16" />
    </IconFrame>
  );
}

export function WalletIcon(props: IconProps) {
  return (
    <IconFrame {...props}>
      <path d="M4 7a2 2 0 0 1 2-2h11v4" />
      <rect x="4" y="9" width="16" height="11" rx="2" />
      <path d="M16 14.5h.01" />
    </IconFrame>
  );
}

export function HomeIcon(props: IconProps) {
  return (
    <IconFrame {...props}>
      <path d="m4 11 8-7 8 7" />
      <path d="M6 9.5V20h12V9.5" />
      <path d="M10 20v-5h4v5" />
    </IconFrame>
  );
}

/** A child's face with a curl: dependants, family members. */
export function ChildIcon(props: IconProps) {
  return (
    <IconFrame {...props}>
      <circle cx="12" cy="13" r="8" />
      <path d="M9.5 15c.8.7 1.6 1 2.5 1s1.7-.3 2.5-1" />
      <path d="M9 11.5h.01" />
      <path d="M15 11.5h.01" />
      <path d="M12 5c0-1.4.9-2 2-2" />
    </IconFrame>
  );
}

/** A percent sign: a loan, an interest-bearing debt. */
export function LoanIcon(props: IconProps) {
  return (
    <IconFrame {...props}>
      <path d="M19 5 5 19" />
      <circle cx="7" cy="7" r="2.5" />
      <circle cx="17" cy="17" r="2.5" />
    </IconFrame>
  );
}

export function SparkleIcon(props: IconProps) {
  return (
    <IconFrame {...props}>
      <path d="M12 3c.6 3.8 3.2 6.4 7 7-3.8.6-6.4 3.2-7 7-.6-3.8-3.2-6.4-7-7 3.8-.6 6.4-3.2 7-7Z" />
      <path d="M19 16v4" />
      <path d="M17 18h4" />
    </IconFrame>
  );
}

export function TrashIcon(props: IconProps) {
  return (
    <IconFrame {...props}>
      <path d="M3 6h18" />
      <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
      <path d="M10 11v6M14 11v6" />
      <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
    </IconFrame>
  );
}

export function DownloadIcon(props: IconProps) {
  return (
    <IconFrame {...props}>
      <path d="M12 4v11" />
      <path d="m7 10 5 5 5-5" />
      <path d="M5 20h14" />
    </IconFrame>
  );
}

export function CopyIcon(props: IconProps) {
  return (
    <IconFrame {...props}>
      <rect x="9" y="9" width="11" height="11" rx="2" />
      <path d="M15 9V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v7a2 2 0 0 0 2 2h3" />
    </IconFrame>
  );
}

export function LogOutIcon(props: IconProps) {
  return (
    <IconFrame {...props}>
      <path d="M9 20H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h3" />
      <path d="m16 16 4-4-4-4" />
      <path d="M20 12H9" />
    </IconFrame>
  );
}

export function PencilIcon({ size = 14, ...props }: IconProps) {
  return (
    <IconFrame size={size} {...props}>
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
    </IconFrame>
  );
}

export function RefreshIcon({ size = 14, ...props }: IconProps) {
  return (
    <IconFrame size={size} {...props}>
      <path d="M21 12a9 9 0 1 1-2.64-6.36" />
      <path d="M21 3v6h-6" />
    </IconFrame>
  );
}

export function TargetIcon(props: IconProps) {
  return (
    <IconFrame {...props}>
      <circle cx="12" cy="12" r="9" />
      <circle cx="12" cy="12" r="5" />
      <circle cx="12" cy="12" r="1" />
    </IconFrame>
  );
}

export function UserIcon(props: IconProps) {
  return (
    <IconFrame {...props}>
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21a8 8 0 0 1 16 0" />
    </IconFrame>
  );
}

export function SlidersIcon(props: IconProps) {
  return (
    <IconFrame {...props}>
      <path d="M4 7h10M18 7h2" />
      <path d="M4 17h2M10 17h10" />
      <circle cx="16" cy="7" r="2" />
      <circle cx="8" cy="17" r="2" />
    </IconFrame>
  );
}

export function FlagIcon(props: IconProps) {
  return (
    <IconFrame {...props}>
      <path d="M5 21V4" />
      <path d="M5 4h12l-2.5 4L17 12H5" />
    </IconFrame>
  );
}

export function EyeIcon(props: IconProps) {
  return (
    <IconFrame {...props}>
      <path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z" />
      <circle cx="12" cy="12" r="3" />
    </IconFrame>
  );
}

export function LockIcon(props: IconProps) {
  return (
    <IconFrame {...props}>
      <rect x="5" y="11" width="14" height="10" rx="2" />
      <path d="M8 11V7a4 4 0 0 1 8 0v4" />
    </IconFrame>
  );
}

export function UnlockIcon(props: IconProps) {
  return (
    <IconFrame {...props}>
      <rect x="5" y="11" width="14" height="10" rx="2" />
      <path d="M8 11V7a4 4 0 0 1 7.7-1.5" />
    </IconFrame>
  );
}

export function PowerIcon(props: IconProps) {
  return (
    <IconFrame {...props}>
      <path d="M12 3v8" />
      <path d="M17.7 6.6a8 8 0 1 1-11.4 0" />
    </IconFrame>
  );
}

export function PlugIcon(props: IconProps) {
  return (
    <IconFrame {...props}>
      <path d="M9 3v4" />
      <path d="M15 3v4" />
      <path d="M6 7h12v4a6 6 0 0 1-12 0V7Z" />
      <path d="M12 17v4" />
    </IconFrame>
  );
}

export function ChatIcon(props: IconProps) {
  return (
    <IconFrame {...props}>
      <path d="M4 6a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H10l-4 3.5V17H6a2 2 0 0 1-2-2V6Z" />
      <path d="M8.5 10.5h7" />
    </IconFrame>
  );
}
