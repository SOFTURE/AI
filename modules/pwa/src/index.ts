// Public API of @softure-ai/pwa: the paths under the public `/pwa/` prefix, the icon registry, the manifest builder,
// the launch screen's counter script, the copy, and the device-data registry cleared on sign-out. The routes an app
// mounts are in `@softure-ai/pwa/next`, the service worker in `@softure-ai/pwa/worker`, the page side (update flow,
// online state) in `@softure-ai/pwa/react`.
import { defineModule } from "@softure-ai/core";

import { pwaMessages } from "./messages/index.js";
import { ICONS_PATH, MANIFEST_PATH, SERVICE_WORKER_PATH, VERSION_PATH } from "./paths.js";

export {
  clearDeviceData,
  registerDeviceData,
  type DeviceDataClearing,
  type DeviceDataDependencies,
  type DeviceDataParts,
  type IndexedDbPart,
} from "./device-data.js";
export { findPwaIcon, getIconMetadata, getIconPath, getIconSizes, PWA_ICONS, type IconLink, type PwaIcon, type PwaIconShape } from "./icons.js";
export {
  buildManifest,
  type ManifestCopy,
  type ManifestDisplay,
  type ManifestIcon,
  type ManifestOptions,
  type WebAppManifest,
} from "./manifest.js";
export { launchProgress, type LaunchProgressConfig, type LaunchProgressPage } from "./launch/launch-progress.js";
export {
  buildLaunchProgressScript,
  DEFAULT_LAUNCH_PROGRESS,
  resolveLaunchProgressConfig,
  type LaunchProgressOptions,
} from "./launch/script.js";
export { pwaMessages, type PwaMessages } from "./messages/index.js";
export { ICONS_PATH, MANIFEST_PATH, PWA_PREFIX, SERVICE_WORKER_PATH, VERSION_PATH } from "./paths.js";

export const MODULE_ID = "pwa";

/**
 * The module for `softure.config.ts` (`modules: [pwa()]`): its manifest names the routes an app mounts, for agents and
 * `softure doctor`. The routes themselves take their options (`@softure-ai/pwa/next`), so an app without a
 * `softure.config.ts` uses them too.
 */
export const pwa = defineModule({
  manifest: {
    id: MODULE_ID,
    version: "0.1.4",
    dependsOn: {},
    dbSchema: null,
    tables: [],
    env: [],
    switches: [],
    routes: { manifest: MANIFEST_PATH, icons: ICONS_PATH, version: VERSION_PATH, serviceWorker: SERVICE_WORKER_PATH },
    mount: [
      { kind: "route-handler", path: "app/pwa/manifest.webmanifest/route.ts", export: "createManifestRoute" },
      { kind: "route-handler", path: "app/pwa/icons/[name]/route.ts", export: "createIconRoute" },
      { kind: "route-handler", path: "app/pwa/version/route.ts", export: "createVersionRoute" },
      { kind: "route-handler", path: "app/sw.js/route.ts", export: "createServiceWorkerRoute" },
    ],
    privacy: { exports: false, deletes: false },
  },
  messages: pwaMessages,
});
