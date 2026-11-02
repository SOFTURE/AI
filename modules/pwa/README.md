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
    page; a page whose streamed HTML ends in a sign-in redirect (Next's `<meta http-equiv="refresh">`) or a failed
    boundary (React's `$RX`) is served but not kept, so an expired session never overwrites the kept copy;
  - Next's hashed files (`/_next/static/`) and the icons are served from the shell first and kept on first use;
  - excluded prefixes are never touched: `/api/`, `/oauth/`, `/.well-known/`, `/cdn-cgi/`, the sign-in and account
    pages, the worker itself;
  - extra origins (e.g. a map's tile host) are kept in their own cache, `<app>-<cache>`, which survives a new build:
    cache first or network first with a timeout, per path, under the URL or a normalized key, stored by the worker or
    only by the page (an area downloaded ahead);
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
- **The launch screen's counter**: `buildLaunchProgressScript(options)` is the text of the inline script inside
  theme-notion's `LaunchScreen`, which an app streams from `app/loading.tsx` so an installed app shows its icon, name
  and progress from the first byte instead of a blank screen (§4).
- **The share target** (Android's share sheet): `shareTarget` in the manifest and `createShareTargetRoute`, which
  reads the shared link (from `url`, else from `text`), text and title, streams the shared files part by part and lets
  the app's `handle` answer where to go; a signed-out user goes to sign-in and comes back with the link and text (§4,
  "Share target").
- **`useIsOnline()`** over `navigator.onLine` (the server render counts as online).
- **Clearing the device on sign-out**: a registry of what the device keeps for the signed-in user
  (`registerDeviceData`, for the app and its modules) and `clearDeviceData()`, which clears every part and the pages
  the worker kept (§10).

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
  id?: string; // startUrl: the installed app's identity; keep the old one when start_url moves
  dir?: "ltr" | "rtl" | "auto"; // left out by default
  scope?: string; // "/"
  display?: "standalone" | "fullscreen" | "minimal-ui" | "browser"; // "standalone"
  backgroundRole?: string; // "background": the splash screen
  themeRole?: string; // "background": the system bars
  shareTarget?: ShareTargetOptions; // the share target (§4, "Share target"); none by default
}

// createIconRoute(options: IconRouteOptions)
interface IconRouteOptions {
  theme: Pick<ThemeDefinition, "name" | "colors">;
  icon: AppIconGlyph; // `Wallet` from `lucide`, or { svg: "<svg …>" }
  tone?: "primary" | "secondary" | "accent" | "inverse"; // "primary"
  strokeWidth?: number; // 2
  // The kit's 0.625 (0.5 maskable) by default. A number sets the rounded and square icons (the maskable one keeps the
  // safe zone); { rounded?, square?, maskable? } sets each shape.
  glyphScale?: number | { rounded?: number; square?: number; maskable?: number };
}

// createServiceWorkerRoute(options: ServiceWorkerOptions)
interface ServiceWorkerOptions {
  app: string; // the caches' prefix: lowercase letters, digits, dashes
  offlinePath: string; // e.g. "/offline"
  excludedPrefixes?: readonly string[]; // replaces DEFAULT_EXCLUDED_PREFIXES; /sw.js is always excluded
  staticPrefixes?: readonly string[]; // ["/_next/static/", "/pwa/icons/"]
  startPath?: string; // the manifest's start_url, kept at install by every build; none by default
  navigationTimeoutMs?: number; // 5000: the network's head start before a kept page answers
  navigationMaxWaitMs?: number; // 12000: with no kept page, the longest wait before the offline page
  assetTimeoutMs?: number; // 10000: the longest wait for a file not kept before it fails
  maxPages?: number; // 60
  extraOrigins?: readonly ExtraOriginOptions[];
}

interface ExtraOriginOptions {
  origin: string;
  pathPrefixes?: readonly string[]; // every path; several entries may name one origin, the first match wins
  cache: string; // the cache `<app>-<cache>`, kept across builds
  maxEntries?: number; // no cap
  strategy?: "cache-first" | "network-first"; // "cache-first"
  timeoutMs?: number; // network-first only: 5000, then the kept copy; with none, the network up to assetTimeoutMs
  cacheKey?: { pattern: string; replacement: string }; // path.replace(new RegExp(pattern), replacement); the URL by default
  store?: boolean; // true; false keeps only what the page put in the cache
}
```

An offline map on one tile host: the style files network first, the tiles from an area the page downloads ahead under
keys without the host's build segment, and nothing stored while browsing.

```ts
const tileKey = { pattern: "^/planet/[^/]+/", replacement: "/planet/" };
extraOrigins: [
  { origin: "https://tiles.example.com", pathPrefixes: ["/planet/"], cache: "map", cacheKey: tileKey, store: false },
  { origin: "https://tiles.example.com", pathPrefixes: ["/styles/", "/planet", "/sprites/", "/fonts/"], cache: "map",
    strategy: "network-first", timeoutMs: 3000 },
],
```

Order matters here: `/planet` covers `/planet/…` too, so the tile entry goes first. The page fills the cache with the
worker's own rule: `(await caches.open(getExtraOriginCacheName("myapp", "map"))).put(getExtraOriginCacheKey(url,
tileKey), response)`, both from `@softure-ai/pwa/worker`.

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

**The start page** (`startPath`, set it to the manifest's `start_url`): the kept pages belong to a build, and a new
build's activation drops the old build's, so without it the first cold start after every deploy finds no page kept.
The install keeps it in the new build's pages with the files its HTML names, best effort: a redirect (signed out), an
error or an incomplete page keeps nothing and never fails the install.

**A silent network** (no signal, a captive Wi-Fi: the connection opens and nothing answers) is never waited for
without limit: a navigation gets its kept page after `navigationTimeoutMs`, else the offline page after
`navigationMaxWaitMs` (the late answer is still kept), and a file not kept fails after `assetTimeoutMs`.

Without React, `watchServiceWorker({ onUpdateReady, onError })` runs the same flow and returns `{ activate, stop }`.

The launch screen, in the root `app/loading.tsx`, so every route streams it at once:

```tsx
import { buildLaunchProgressScript, ICONS_PATH } from "@softure-ai/pwa";
import { LaunchScreen } from "@softure-ai/theme-notion";
import { messages } from "@/messages/en";

const SCRIPT = buildLaunchProgressScript(); // or { paintShare, assetsShare, timeShare, timeConstantMs, intervalMs }

export default function Loading() {
  return <LaunchScreen name={messages.app.name} iconSrc={`${ICONS_PATH}/icon-192.png`} label={messages.pwa.launch.label} script={SCRIPT} />;
}
```

The counter runs while the browser parses the fallback, before hydration (a client component would often never run:
the page replaces the fallback first). Each 100 ms it adds `paintShare` (10) once the first frame is painted,
`assetsShare` (60) in proportion to the page's `script[src]` and stylesheets the browser has received (Resource
Timing), and `timeShare` (29) as `1 - e^(-t / timeConstantMs)` of the time since the navigation started (4 s). The
shares add up to at most 100; the counter shows at most 99%, never falls, and stops once the page replaced the screen.
It finds its root from `document.currentScript` and moves `data-slot="progress"` (`aria-valuenow`, `aria-valuetext`,
`data-value`, `data-state="loading"`), `progress-indicator` (its transform and `data-state`) and `<rootSlot>-percent`
(the text, when there is one). `rootSlot` names the root's `data-slot`: `launch-screen` by default, `top-loading-bar`
for theme-notion's thin bar on wide screens (`TopLoadingBar`, or both through `RouteLoading`, which shows the launch
screen on a phone or in an installed app and the bar in a wide browser tab). The bar starts indeterminate; the
counter's first value makes it determinate. `launchProgress(page, config)` is the function itself, testable with a
fake page.

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
### Share target

An installed app on Android appears in the system share sheet. One options object goes to both the manifest and the
route, so the manifest's `share_target` and the fields the route reads never disagree:

```ts
// share-target.ts
import type { ShareTargetOptions } from "@softure-ai/pwa";
export const shareTarget: ShareTargetOptions = {
  action: "/share", // a same-origin path inside the manifest's scope
  params: { url: "url", text: "text", title: "title" }, // the field names; these are the defaults
  files: [{ name: "media", accept: ["image/*", "video/*", ".pdf"] }], // optional: with files the share is a POST
};

// app/pwa/manifest.webmanifest/route.ts
export const GET = createManifestRoute({ theme, copy: messages.app, lang: "en", shareTarget });

// app/share/route.ts
import { createShareTargetRoute } from "@softure-ai/pwa/next";
import { getFilesContext } from "@softure-ai/files/next";
import { saveFile } from "@softure-ai/files/server";
import { getCurrentUser } from "@/auth"; // the app's own: the signed-in user from the request's cookies, or null

export const { GET, POST } = createShareTargetRoute({
  shareTarget,
  getUser: (request) => getCurrentUser(request),
  signInPath: "/login", // a signed-out share goes to /login?next=/share?url=…&text=…&title=…
  async handle({ user }, { url, text, title, files }) {
    const ctx = await getFilesContext();
    const fileIds: string[] = [];
    for await (const file of files) {
      // Streamed into the file store under its size cap and the owner's quota, never held whole in memory.
      const saved = await saveFile(ctx, { ownerId: user.id, name: file.name, contentType: file.contentType, body: file.body, kind: "share" });
      if (saved.ok) fileIds.push(saved.value.id);
    }
    const job = await enqueueImport({ userId: user.id, url, text, title, fileIds }); // the app's own action
    return `/imports/${job.id}`; // a same-origin path: the route answers 303 to it
  },
});
export const dynamic = "force-dynamic";
```

- **The manifest**: without files, `{ action, method: "GET", params }`; with files,
  `{ action, method: "POST", enctype: "multipart/form-data", params: { …, files } }`. `accept` takes MIME types
  (`image/*`, `application/pdf`) or extensions (`.pdf`).
- **The share**: `url` is the first http(s) link in the `url` field, else in `text` (many apps put "Look at this
  https://…" in `text` and leave `url` empty), without trailing punctuation, normalized; null when there is none.
  `text` and `title` come as sent, an empty value as null.
- **Files** are an async iterable of `{ field, name, contentType, body }`, in the order the system sent them. Each
  `body` streams from the request: read it (or hand it to `saveFile`) before asking for the next file; a file left
  unread is skipped, and whatever is left when `handle` returns is dropped with the request. Only declared file fields
  and accepted types are handed on, at most `maxFiles` (10). `name` is the system's file name, unsanitized
  (`saveFile` sanitizes it). The text fields are read up to the first file part (Chrome sends them first); a text
  field after a file is ignored.
- **Signed out** (`getUser` answers null): 303 to `signInPath` with `next` (`returnParam`) set to the action and the
  link, text and title as a query; the sign-in page returns there and the route's `GET` resumes the share. Files do
  not survive the redirect. Without `getUser`, `handle` gets `user: null` and every share runs.
- **Answers**: 303 to `handle`'s path; 400 for a broken multipart body (also while `handle` reads the files); 413
  for a `url`, `text` or `title` over `maxFieldBytes` (16 KiB); 415 for a `POST` that is not `multipart/form-data`.
  A `handle` that answers anything but a same-origin path (`/x`, never `//x`) throws: an open redirect is a bug.
- **Options** are checked when the route module loads (an action that is not a same-origin path, duplicate or empty
  field names, an empty or invalid `accept`, a `signInPath` on another origin), so a wrong option fails the build.
- The parts are reusable without the route: `findSharedUrl({ url, text })`, `isAcceptedFile(accept, file)`,
  `readMultipart(stream, boundary)` (a streaming `multipart/form-data` reader) and `getMultipartBoundary(contentType)`
  from `@softure-ai/pwa`. In a Playwright test, `shareToApp` of `@softure-ai/testing/playwright` posts a share the way
  the system does.

**iOS** has no Web Share Target: Safari ignores `share_target`, so an installed app never appears in the iOS share
sheet. The fallbacks are a paste button that reads the clipboard (`navigator.clipboard.readText()` after a tap) and
feeds the same action, or an iOS Shortcut ("Receive URLs and text from the share sheet", then "Get contents of URL"
with a POST to an app API under a personal token) that the user installs once.

## 5. Migrations and tables

None. The package has no database.

## 6. Environment variables

None. Under `next dev` (`NODE_ENV=development`) the page registers no worker.

## 7. Switches

None.

## 8. Appearance

The package draws nothing on the page. The icons take the theme's colours (`tone`, `primary` by default, through
theme-kit's `drawAppIcon`), the manifest the theme's `background` value. The update prompt is the theme's
`UpdatePrompt`, the install bar its `InstallBar`, the launch screen its `LaunchScreen`.

## 9. Copy

`pwaMessages.en.update`: `title`, `description`, `reload`, the update prompt's copy. `pwaMessages.en.install`: `title`,
`description`, `install` (the prompt button), `shareStep` and `addStep` (the iOS steps), `close` (the close button's
accessible name), the install bar's copy. `pwaMessages.en.launch`: `label`, the launch screen's progress bar name. The manifest's `name`,
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
- `registerDeviceData({ caches?, indexedDb?, storageKeys? })`: what the device keeps for the signed-in user. `caches`
  are Cache Storage names (deleted whole), `indexedDb` entries `{ database, store? }` (the whole database, or one store
  emptied), `storageKeys` `localStorage` keys. Call it once per owner, at module load of a client file; it returns
  `unregister()`. The parts of every registration are cleared together, each once.
- `clearDeviceData(dependencies?)` → `{ failed }`: clears every registered part and sends the controlling worker
  `clear-pages`. Every part is tried even when another fails, a part that throws at once included; `failed` names the
  parts left (`cache:<name>`, `indexedDb:<database>`, `indexedDb:<database>/<store>`, `storage:<key>`,
  `worker:clear-pages`). It never rejects. A missing API (no Cache Storage, no IndexedDB, no `localStorage`, no
  controlling worker) is skipped. A database another tab holds open counts as failed instead of holding the
  sign-out (the browser deletes it once that tab closes it). The browser APIs are injectable for tests.
- On sign-out, `LogoutForm` of `@softure-ai/auth/ui` takes it as `beforeSignOut`:

  ```tsx
  "use client";
  import { logoutAction } from "@softure-ai/auth/next";
  import { LogoutForm } from "@softure-ai/auth/ui";
  import type { AuthMessages } from "@softure-ai/auth";
  import { clearDeviceData, registerDeviceData } from "@softure-ai/pwa";

  registerDeviceData({ caches: ["fire-tiles"], indexedDb: [{ database: "fire" }], storageKeys: ["fire-draft"] });

  async function clearDevice(): Promise<void> {
    const { failed } = await clearDeviceData();
    if (failed.length > 0) console.error(`sign-out: device data left: ${failed.join(", ")}`);
  }

  export function SignOut({ messages }: { messages: AuthMessages }) {
    return <LogoutForm action={logoutAction} messages={messages} beforeSignOut={clearDevice} />;
  }
  ```

## 11. GDPR

The worker keeps copies of pages the user opened, in the browser, under this build's `<app>-pages-<build>` cache.
They leave with the next build's activate, or at once with the `clear-pages` message.

What the device keeps for a user (kept pages, an offline snapshot in IndexedDB, cached files, `localStorage` keys) is
personal data on a device that may be shared. Register every such part with `registerDeviceData` and clear it with
`clearDeviceData()` before the sign-out (§10); the failed parts are returned so the app logs them, and the sign-out
goes on. A part that was not registered stays on the device. Cookies are the auth package's: its logout clears the
session cookie.

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
- `clearDeviceData` clears only what was registered and the current build's kept pages; a database another tab holds
  open is reported as failed and deleted by the browser once that tab closes it. A sign-out on another device or in
  another browser clears nothing here.
- The launch screen covers the time from the first byte. Before it, iOS shows the manifest's background: the package
  draws no `apple-touch-startup-image` (one image per device size and orientation).
- On a client-side navigation React inserts the launch screen without running its script, so the bar stays at 0%;
  the counter moves on a page load (the app's launch, a reload).
- **The share target** works where the browser supports it: Chromium on Android for an installed app. Safari (iOS,
  macOS) has none (see §4, "Share target", for the fallbacks), and desktop Chromium shows it only on some platforms.
- A share with files that arrives offline is not kept: the worker never touches a `POST`, so the system shows the
  browser's offline error and the user shares again once online. A signed-out share keeps its link and text across the
  sign-in, not its files.
- Not in this package (filed): Playwright helpers for installed-app checks (#875).

## Build

`npm run build -w modules/pwa` runs `tsc -p tsconfig.build.json`. The worker is shipped as the compiled function's
text, so it stays self-contained: `tests/built-worker.test.ts` compiles it as the build does and runs its text alone.
Releasing: [scripts/release/README.md](../../scripts/release/README.md).
