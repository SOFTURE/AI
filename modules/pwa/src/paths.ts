/**
 * The one public prefix for everything a phone's installer fetches without the page's cookies: the manifest, the
 * icons and the build's version. An app behind an outer sign-in (an access proxy) lets this prefix through and
 * nothing else; it serves only the app's name, colours and mark.
 */
export const PWA_PREFIX = "/pwa";

/** The manifest's path: `app/pwa/manifest.webmanifest/route.ts`. */
export const MANIFEST_PATH = `${PWA_PREFIX}/manifest.webmanifest`;

/** The icons' folder: `app/pwa/icons/[name]/route.ts`. */
export const ICONS_PATH = `${PWA_PREFIX}/icons`;

/** The build version's path: `app/pwa/version/route.ts`. */
export const VERSION_PATH = `${PWA_PREFIX}/version`;

/** The service worker's path: `app/sw.js/route.ts`. At the root, so its scope is the whole app. */
export const SERVICE_WORKER_PATH = "/sw.js";
