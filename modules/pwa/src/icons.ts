import { ICONS_PATH } from "./paths.js";

/** `rounded` for a tab icon, `square` for the apple icon (iOS cuts its own shape), `maskable` for launchers that crop. */
export type PwaIconShape = "rounded" | "square" | "maskable";

export interface PwaIcon {
  /** The file name under `/pwa/icons/`. */
  readonly name: string;
  /** The side in pixels; every icon is square. */
  readonly size: number;
  readonly shape: PwaIconShape;
  /** Where the icon is named: the head's tab icon, the head's apple icon, or the manifest (with its `purpose`). */
  readonly use: "tab" | "apple" | "manifest";
  /** The manifest's `purpose`; `null` outside the manifest. */
  readonly purpose: "any" | "maskable" | null;
}

/** Every icon the package draws. A name outside this list is a 404. */
export const PWA_ICONS: readonly PwaIcon[] = [
  { name: "icon-32.png", size: 32, shape: "rounded", use: "tab", purpose: null },
  { name: "apple-icon-180.png", size: 180, shape: "square", use: "apple", purpose: null },
  { name: "icon-192.png", size: 192, shape: "rounded", use: "manifest", purpose: "any" },
  { name: "icon-512.png", size: 512, shape: "rounded", use: "manifest", purpose: "any" },
  { name: "icon-maskable-512.png", size: 512, shape: "maskable", use: "manifest", purpose: "maskable" },
];

/** The registry's entry for a file name, or `null` for a name outside it. */
export function findPwaIcon(name: string): PwaIcon | null {
  return PWA_ICONS.find((icon) => icon.name === name) ?? null;
}

/** The icon's public path, e.g. `/pwa/icons/icon-192.png`. */
export function getIconPath(icon: PwaIcon): string {
  return `${ICONS_PATH}/${icon.name}`;
}

/** The `sizes` value of the icon's `<link>` or manifest entry, e.g. `192x192`. */
export function getIconSizes(icon: PwaIcon): string {
  return `${icon.size}x${icon.size}`;
}

export interface IconLink {
  readonly url: string;
  readonly sizes: string;
  readonly type: "image/png";
}

/**
 * The head's icon links in the shape of Next's `Metadata["icons"]`: `export const metadata = { icons: getIconMetadata() }`
 * renders `<link rel="icon">` and `<link rel="apple-touch-icon">` with the registry's paths and sizes.
 */
export function getIconMetadata(): { icon: IconLink[]; apple: IconLink[] } {
  const toLink = (icon: PwaIcon): IconLink => ({ url: getIconPath(icon), sizes: getIconSizes(icon), type: "image/png" });
  return {
    icon: PWA_ICONS.filter((icon) => icon.use === "tab").map(toLink),
    apple: PWA_ICONS.filter((icon) => icon.use === "apple").map(toLink),
  };
}
