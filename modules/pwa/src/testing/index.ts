// Test helpers for an app's service worker: run `serviceWorker` from `@softure-ai/pwa/worker` with the app's options in
// Node, against a fake scope whose caches, network and events the test controls (README §10).
export {
  answer,
  cloneAnswer,
  FakeCache,
  FakeCacheStorage,
  FakeWorkerScope,
  navigation,
  ORIGIN,
  type AnswerOptions,
  type DispatchedFetch,
  type FetchHandler,
} from "./fake-worker-scope.js";
