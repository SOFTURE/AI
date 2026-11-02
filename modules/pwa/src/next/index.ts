// The Next.js adapter: the route handlers an app mounts under `/pwa/`, at `/sw.js` and at its share target's action,
// and the build version.
export { DEV_BUILD_VERSION, getBuildVersion, readBuildVersion } from "./build-version.js";
export {
  createIconRoute,
  createManifestRoute,
  createServiceWorkerRoute,
  createVersionRoute,
  type IconRoute,
  type IconRouteContext,
  type IconRouteOptions,
} from "./routes.js";
export {
  createShareTargetRoute,
  type ShareHandleContext,
  type SharedContent,
  type SharedFile,
  type ShareTargetRoute,
  type ShareTargetRouteOptions,
} from "./share-target-route.js";
