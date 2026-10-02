// Public API of @softure-ai/core: the contract every SOFTURE module stands on
// (docs/02-module-standard.md). The Next.js registry is a separate entry: `@softure-ai/core/next`.
export { createTestClock, systemClock, type Clock, type TestClock } from "./clock.js";
export {
  formatMessage,
  getMessage,
  isLocale,
  LOCALES,
  mergeMessages,
  selectPlural,
  type DeepPartial,
  type Dictionaries,
  type Locale,
  type MessageOverrides,
  type MessageTree,
  type PluralForms,
} from "./i18n.js";
export { coreMessages, type CoreMessages } from "./messages/index.js";
export { err, ok, type Err, type ErrorCode, type Ok, type Result } from "./result.js";
export { errorLogLabel, safeError, type CoreErrorCode } from "./safe-error.js";
export {
  defineSoftureConfig,
  getModule,
  sortModulesByDependencies,
  type SoftureConfig,
  type SoftureConfigInput,
} from "./config.js";
export { SoftureConfigError } from "./config-error.js";
export { moduleManifestSchema, type ModuleManifest } from "./manifest.js";
export {
  defineModule,
  toModuleJson,
  type AnySoftureModule,
  type ModuleContext,
  type ModuleFactory,
  type ModuleInput,
  type ModuleMigrations,
  type ModuleSpec,
  type PrivacyContributor,
  type SoftureModule,
} from "./module.js";
export { isVersion, parseVersionRange, satisfiesRange, type Version, type VersionRange } from "./version-range.js";
