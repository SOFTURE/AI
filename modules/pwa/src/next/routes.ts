// The files an app mounts, one line each (README §4):
// - `app/pwa/manifest.webmanifest/route.ts`: `export const GET = createManifestRoute({ theme, copy, lang });`
// - `app/pwa/icons/[name]/route.ts`: `export const { GET, generateStaticParams } = createIconRoute({ theme, icon });`
//   plus `export const dynamicParams = false;` (segment config must be a literal in the route file)
// - `app/pwa/version/route.ts`: `export const GET = createVersionRoute();`
// - `app/sw.js/route.ts`: `export const GET = createServiceWorkerRoute({ app: "myapp", offlinePath: "/offline" });`
import { drawAppIcon, type AppIconGlyph, type AppIconTone } from "@softure-ai/theme-kit/next";
import type { ThemeDefinition } from "@softure-ai/theme-kit";

import { findPwaIcon, PWA_ICONS, type PwaIconShape } from "../icons.js";
import { buildManifest, type ManifestOptions } from "../manifest.js";
import { buildServiceWorkerSource, resolveServiceWorkerConfig, type ServiceWorkerOptions } from "../worker/source.js";
import { DEV_BUILD_VERSION, getBuildVersion } from "./build-version.js";

/** `GET /pwa/manifest.webmanifest`: the manifest as `application/manifest+json`. */
export function createManifestRoute(options: ManifestOptions): () => Response {
  // Built when the route module loads, so a wrong option (a share target's) fails the build.
  const body = JSON.stringify(buildManifest(options));
  return () =>
    new Response(body, {
      headers: { "content-type": "application/manifest+json; charset=utf-8", "cache-control": "no-cache" },
    });
}

export interface IconRouteOptions {
  /** Any theme that meets the contract (`theme` from `@softure-ai/theme-<name>`). */
  readonly theme: Pick<ThemeDefinition, "name" | "colors">;
  /** The app's mark: a stroke icon as data (`Wallet` from `lucide`) or a standalone `<svg>`. */
  readonly icon: AppIconGlyph;
  /** `primary` by default. */
  readonly tone?: AppIconTone;
  /** The stroke width of an icon given as data: lucide's 2 by default. */
  readonly strokeWidth?: number;
  /**
   * The glyph's side as a share of the icon's side, the kit's scale by default (0.625, 0.5 for `maskable`). A number
   * applies to the `rounded` and `square` icons, and the maskable one keeps the safe zone; a record sets it per shape.
   */
  readonly glyphScale?: number | Partial<Readonly<Record<PwaIconShape, number>>>;
}

/** The glyph scale for one shape, or `undefined` for the kit's default. */
function getGlyphScale(glyphScale: IconRouteOptions["glyphScale"], shape: PwaIconShape): number | undefined {
  if (typeof glyphScale === "number") return shape === "maskable" ? undefined : glyphScale;
  return glyphScale?.[shape];
}

export interface IconRouteContext {
  readonly params: Promise<{ name: string }>;
}

export interface IconRoute {
  /** `GET /pwa/icons/<name>`: the icon as a PNG, or 404 for a name outside the registry. */
  readonly GET: (request: Request, context: IconRouteContext) => Promise<Response>;
  /** Every name in the registry, so the build draws each icon once. */
  readonly generateStaticParams: () => { name: string }[];
}

export function createIconRoute({ theme, icon, tone, strokeWidth, glyphScale }: IconRouteOptions): IconRoute {
  return {
    async GET(_request, { params }) {
      const entry = findPwaIcon((await params).name);
      if (entry === null) return new Response(null, { status: 404 });
      const size = { width: entry.size, height: entry.size };
      return drawAppIcon({ theme, icon, tone, strokeWidth, size, shape: entry.shape, glyphScale: getGlyphScale(glyphScale, entry.shape) });
    },
    generateStaticParams: () => PWA_ICONS.map((entry) => ({ name: entry.name })),
  };
}

/** `GET /pwa/version`: `{ "version": "<build id>" }`, never cached, so a page can ask whether a new build is out. */
export function createVersionRoute(): () => Response {
  return () => Response.json({ version: getBuildVersion() }, { headers: { "cache-control": "no-store" } });
}

/**
 * `GET /sw.js`: the service worker for this build. `no-cache` so the browser checks it on every update, and
 * `Service-Worker-Allowed: /` so it controls the whole app.
 */
export function createServiceWorkerRoute(options: ServiceWorkerOptions): () => Response {
  // Checked when the route module loads, so a wrong option fails the build, not the first visitor.
  const config = resolveServiceWorkerConfig(options, DEV_BUILD_VERSION);
  return () => {
    const source = buildServiceWorkerSource({ ...config, build: getBuildVersion() });
    return new Response(source, {
      headers: {
        "content-type": "text/javascript; charset=utf-8",
        "cache-control": "no-cache",
        "service-worker-allowed": "/",
      },
    });
  };
}
