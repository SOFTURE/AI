// The page side: the new-build update flow (headless, and as a hook), the online state and the install offer.
export { isInstalledApp, isIosDevice, isPhoneDevice, type DeviceNavigator, type DeviceWindow } from "./device.js";
export { pickInstallOffer, type InstallOffer, type InstallOfferFacts } from "./install-offer.js";
export { getInstallOfferKey, isInstallOfferClosed, rememberInstallOfferClosed, type InstallOfferStorage } from "./install-offer-storage.js";
export {
  createInstallPromptStore,
  installPromptStore,
  openInstallPrompt,
  type InstallPromptEvent,
  type InstallPromptStore,
  type InstallPromptTarget,
} from "./install-prompt.js";
export { useInstallOffer, type InstallOfferOptions, type InstallOfferState } from "./use-install-offer.js";
export { useIsOnline } from "./use-is-online.js";
export { useServiceWorkerUpdate, type ServiceWorkerUpdate, type ServiceWorkerUpdateOptions } from "./use-service-worker-update.js";
export {
  watchServiceWorker,
  type ServiceWorkerWatch,
  type VisibilitySource,
  type WaitingWorker,
  type WatchServiceWorkerOptions,
  type WorkerContainer,
  type WorkerRegistration,
} from "./watch-service-worker.js";
