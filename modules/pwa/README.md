# @softure-ai/pwa

An installable Next.js app that works offline: the web app manifest, the icons, a service worker served from a route,
the new-build update flow, the install offer for phones and the online state. The app keeps only what is its own: its copy, its offline page and its
mark.

## 1. What it provides

- **One public prefix, `/pwa/`.** Everything a phone's installer fetches without the page's cookies lives under it:
  the manifest (`/pwa/manifest.webmanifest`), the icons (`/pwa/icons/<name>`) and the build's version
  (`/pwa/version`). It serves only the app's name, colours and mark, so an app behind an outer sign-in lets this one
  prefix through (see §12, "Behind an access proxy").
- **The manifest** from the theme's token values (`background_color`, `theme_color`: values, since the installer reads
  them outside the page) and the app's copy (`name`, `short_name`, `description`, `lang`), served as
  `application/manifest+json`.
- **The icons**: one registry (`PWA_ICONS`) of `icon-32.png` (tab), `apple-icon-180.png` (square: iOS cuts its own
  shape), `icon-192.png`, `icon-512.png` and `icon-maskable-512.png` (manifest), drawn once at build by theme-kit's
  `drawAppIcon`. A name outside the registry is a 404. The head's `<link>`s come from the same registry
  (`getIconMetadata()`).
- **The service worker** at `/sw.js`, generated from one self-contained function (`serviceWorker` in
  `@softure-ai/pwa/worker`) and a JSON config, so it is unit-tested in Node and every build changes its bytes:
  - caches `<app>-shell-<build>` and `<app>-pages-<build>`; activate drops the app's caches of other builds and claims
    the open pages;
  - install keeps the offline page and the same-origin scripts, styles and icons its HTML names;
  - a navigation goes to the network first, with a 5 s timeout, then to the kept copy of the page, then to the offline
    page; at most 60 pages are kept, the least recently kept dropped first;
  - only whole same-origin answers are kept: 200, fetched by the browser itself (`basic`), not redirected, HTML for a
    page;
  - Next's hashed files (`/_next/static/`) and the icons are served from the shell first and kept on first use;
  - excluded prefixes are never touched: `/api/`, `/oauth/`, `/.well-known/`, `/cdn-cgi/`, the sign-in and account
    pages, the worker itself;
  - extra origins (e.g. a map's tile host) are kept in their own cache, `<app>-<cache>`, which survives a new build;
  - messages `{ type: "skip-waiting" }` and `{ type: "clear-pages" }`.
- **The new-build update flow** on the page: registration with `updateViaCache: "none"`; a worker that installs while
  another controls the page waits (no `skipWaiting` at install); the page offers a reload, and reloads only after the
  user's `activate()` once the new worker controls it, never on the first install; `registration.update()` on every
  return to the foreground; no worker under `next dev`; a failed registration is reported and the app keeps working.
  The prompt is a theme component (`UpdatePrompt` in `@softure-ai/theme-notion`).
- **The build version**: `.next/BUILD_ID`, read once per process, `dev` without a build.
- **The install offer for phones** (`useInstallOffer({ app })`): Chromium's `beforeinstallprompt` is kept from the
  moment `@softure-ai/pwa/react` loads (it often fires before hydration), with `preventDefault()` to stop the
  browser's mini bar, and forgotten on `appinstalled` (`installPromptStore`, a `useSyncExternalStore` store with a
  `null` server snapshot; `openInstallPrompt()` uses it once and answers whether the sheet opened). The offer is a pure
  function, `pickInstallOffer({ isIos, isPhone, isInstalled, isClosed, hasPrompt })` → `"ios_steps"`,
  `"browser_prompt"` or `"none"`: an iOS device (an iPad reporting a Mac user agent too) gets the steps, a phone with a
  kept prompt gets the prompt, a desktop and the installed app never get an offer. The device facts are
  `isIosDevice`, `isPhoneDevice` (`navigator.userAgentData.mobile` where present, else `Mobi|Android`) and
  `isInstalledApp` (`display-mode: standalone` or iOS `navigator.standalone`). Closing it is remembered per device in
  `localStorage` under `<app>:pwa-install-closed`; a blocked storage shows the offer, a refused write closes it for the
  open page only. The bar is a theme component (`InstallBar` in `@softure-ai/theme-notion`).
- **`useIsOnline()`** over `navigator.onLine` (the server render counts as online).

## 2. Installation

```bash
npm install @softure-ai/pwa @softure-ai/theme-kit
```

Peers: `next` 16, `react` 19, `@softure-ai/theme-kit` 0.1.7 or later, and the app's theme package.

## 3. Configuration

No `softure.config.ts` entry: every route factory takes its options.

```ts
// createManifestRoute(options: ManifestOptions)
interface ManifestOptions {
  theme: Pick<ThemeDefinition, "name" | "colors">; // `theme` from @softure-ai/theme-<name>
  copy: { name: string; shortName: string; description: string }; // from the app's messages
  lang: string;
  startUrl?: string; // "/"
  scope?: string; // "/"
  display?: "standalone" | "fullscreen" | "minimal-ui" | "browser"; // "standalone"
  backgroundRole?: string; // "background": the splash screen
  themeRole?: string; // "background": the system bars
}

// createIconRoute(options: IconRouteOptions)
interface IconRouteOptions {
  theme: Pick<ThemeDefinition, "name" | "colors">;
  icon: AppIconGlyph; // `Wallet` from `lucide`, or { svg: "<svg …>" }
  tone?: "primary" | "secondary" | "accent" | "inverse"; // "primary"
  strokeWidth?: number; // 2
}

// createServiceWorkerRoute(options: ServiceWorkerOptions)
interface ServiceWorkerOptions {
  app: string; // the caches' prefix: lowercase letters, digits, dashes
  offlinePath: string; // e.g. "/offline"
  excludedPrefixes?: readonly string[]; // replaces DEFAULT_EXCLUDED_PREFIXES; /sw.js is always excluded
  staticPrefixes?: readonly string[]; // ["/_next/static/", "/pwa/icons/"]
  navigationTimeoutMs?: number; // 5000
  maxPages?: number; // 60
  extraOrigins?: readonly { origin: string; cache: string; maxEntries?: number }[];
}
```

A prefix matches whole path segments: `/login` covers `/login` and `/login/sso`, not `/logins`. To add to the defaults:
`excludedPrefixes: [...DEFAULT_EXCLUDED_PREFIXES, "/admin"]`. The route checks its options when the module loads, so a
wrong option fails the build.

## 4. Mounting

```ts
// app/pwa/manifest.webmanifest/route.ts
import { createManifestRoute } from "@softure-ai/pwa/next";
import { theme } from "@softure-ai/theme-notion";
import { messages } from "@/messages/en";
export const GET = createManifestRoute({ theme, copy: messages.app, lang: "en" });

// app/pwa/icons/[name]/route.ts
import { createIconRoute } from "@softure-ai/pwa/next";
import { theme } from "@softure-ai/theme-notion";
import { Wallet } from "lucide";
export const { GET, generateStaticParams } = createIconRoute({ theme, icon: Wallet });
export const dynamicParams = false; // segment config must be a literal in the route file

// app/pwa/version/route.ts
import { createVersionRoute } from "@softure-ai/pwa/next";
export const GET = createVersionRoute();
export const dynamic = "force-dynamic";

// app/sw.js/route.ts
import { createServiceWorkerRoute } from "@softure-ai/pwa/next";
export const GET = createServiceWorkerRoute({ app: "fire", offlinePath: "/offline" });
export const dynamic = "force-dynamic"; // the build version is read at runtime, in the running image
```

In the root layout:

```tsx
import { getIconMetadata, MANIFEST_PATH } from "@softure-ai/pwa";
export const metadata = { manifest: MANIFEST_PATH, icons: getIconMetadata() };
```

And once, near the root, a client component with the prompt:

```tsx
"use client";
import type { PwaMessages } from "@softure-ai/pwa";
import { useServiceWorkerUpdate } from "@softure-ai/pwa/react";
import { UpdatePrompt } from "@softure-ai/theme-notion";
export function AppUpdate({ messages }: { messages: PwaMessages }) {
  const { isUpdateReady, activate } = useServiceWorkerUpdate();
  return <UpdatePrompt open={isUpdateReady} onReload={activate} {...messages.update} />;
}
```

**The offline page** (`offlinePath`) is the app's own: a static page that renders without a session and without data
(no `cookies()`, no database), with the app's look. The install fetches it and keeps every same-origin script, style
and icon its HTML names; if it answers anything but a 200 HTML page, the install fails and the running worker stays.

Without React, `watchServiceWorker({ onUpdateReady, onError })` runs the same flow and returns `{ activate, stop }`.

The install offer, in the same kind of client component (`app` is the same id as the service worker route's):

```tsx
"use client";
import type { PwaMessages } from "@softure-ai/pwa";
import { useInstallOffer } from "@softure-ai/pwa/react";
import { InstallBar } from "@softure-ai/theme-notion";
export function AppInstall({ messages }: { messages: PwaMessages }) {
  const { offer, install, close } = useInstallOffer({ app: "fire" });
  return <InstallBar offer={offer} onInstall={() => void install()} onClose={close} {...messages.install} />;
}
```

The kept prompt listens from the moment `@softure-ai/pwa/react` loads: import it from a client component rendered by
the root layout, so the module is in the first page's bundle. Without React, `installPromptStore` (`subscribe`,
`getSnapshot`) and `openInstallPrompt()` give the same prompt, and `pickInstallOffer` with the device facts and
`isInstallOfferClosed(getInstallOfferKey(app))` the same offer.

## 5. Migrations and tables

None. The package has no database.

## 6. Environment variables

None. Under `next dev` (`NODE_ENV=development`) the page registers no worker.

## 7. Switches

None.

## 8. Appearance

The package draws nothing on the page. The icons take the theme's colours (`tone`, `primary` by default, through
theme-kit's `drawAppIcon`), the manifest the theme's `background` value. The update prompt is the theme's
`UpdatePrompt`, the install bar its `InstallBar`.

## 9. Copy

`pwaMessages.en.update`: `title`, `description`, `reload`, the update prompt's copy. `pwaMessages.en.install`: `title`,
`description`, `install` (the prompt button), `shareStep` and `addStep` (the iOS steps), `close` (the close button's
accessible name), the install bar's copy. The manifest's `name`,
`shortName` and `description` are the app's own copy, passed to `createManifestRoute`.

## 10. Hooks

- `useServiceWorkerUpdate({ onError })`: a failed registration (default: `console.error`; the app keeps working).
- `watchServiceWorker({ onUpdateReady, onError, container, visibility, reload, isDevelopment })`: every browser
  dependency is injectable for tests.
- `useInstallOffer({ app, store })`: `store` replaces the page's `installPromptStore` (tests, or a store over another
  event target from `createInstallPromptStore(target)`). The device facts and the storage helpers take the navigator,
  the window and the storage as arguments, the browser's own by default.
- `extraOrigins`: the worker's extension point for another origin with its own cache.
- A page sends the worker `{ type: "clear-pages" }` to drop the kept pages (e.g. on sign-out).

## 11. GDPR

The worker keeps copies of pages the user opened, in the browser, under this build's `<app>-pages-<build>` cache.
They leave with the next build's activate, or at once with the `clear-pages` message. Clearing everything the device
keeps on sign-out is a follow-up (#874).

## 12. Limitations

- **Behind an access proxy** (an outer sign-in such as Cloudflare Access or a Traefik forward-auth): a phone's
  installer fetches the manifest and the icons without the page's cookies, so let `/pwa/` through (and nothing else
  under it). With Cloudflare Access, a bypass application on `<host>/pwa/`; with Traefik, a router on
  ``PathPrefix(`/pwa/`)`` with a higher priority and without the auth middleware. `/sw.js` stays behind the proxy:
  the browser registers it from the signed-in page, with its cookies.
- **Traefik and other proxies** must not cache or compress `/sw.js` into a stale copy: the route answers
  `Cache-Control: no-cache` and `Service-Worker-Allowed: /`; keep both headers.
- The worker keeps pages only after a visit; a page never opened online is the offline page.
- An excluded prefix is untouched: those pages show the browser's own offline error.
- The install offer covers Chromium's prompt and iOS Safari's steps. Other browsers (Firefox on Android, Samsung
  Internet without the prompt) get no offer; their own menu still installs the app.
- Not in this package (filed): clearing the device on sign-out (#874), Playwright helpers for installed-app checks
  (#875).

## Build

`npm run build -w modules/pwa` runs `tsc -p tsconfig.build.json`. The worker is shipped as the compiled function's
text, so it stays self-contained: `tests/built-worker.test.ts` compiles it as the build does and runs its text alone.
Releasing: [scripts/release/README.md](../../scripts/release/README.md).
