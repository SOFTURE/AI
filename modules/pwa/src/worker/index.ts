// The service worker: the function itself (testable in Node with a fake scope), its config and the source builder
// that `createServiceWorkerRoute` serves at `/sw.js`.
export {
  serviceWorker,
  type ExtraOrigin,
  type ServiceWorkerConfig,
  type ServiceWorkerMessage,
  type WorkerExtendableEvent,
  type WorkerFetchEvent,
  type WorkerMessageEvent,
  type WorkerScope,
} from "./service-worker.js";
export {
  buildServiceWorkerSource,
  DEFAULT_ASSET_TIMEOUT_MS,
  DEFAULT_EXCLUDED_PREFIXES,
  DEFAULT_MAX_PAGES,
  DEFAULT_NAVIGATION_MAX_WAIT_MS,
  DEFAULT_NAVIGATION_TIMEOUT_MS,
  DEFAULT_STATIC_PREFIXES,
  resolveServiceWorkerConfig,
  type ExtraOriginOptions,
  type ServiceWorkerOptions,
} from "./source.js";
