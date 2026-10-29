// The Next.js adapter: the route handlers an app mounts under `/pwa/` and at `/sw.js`, and the build version.
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
