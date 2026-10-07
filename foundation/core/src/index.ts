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
export { errorLogLabel, getPublicMessage, isPublicError, PublicError, safeError, type CoreErrorCode } from "./safe-error.js";
export {
  defineSoftureConfig,
  getModule,
  sortModulesByDependencies,
  type SoftureConfig,
  type SoftureConfigInput,
  type SoftureDatabaseConfig,
  type SoftureDatabaseHandle,
  type SoftureDatabaseHandleTypes,
} from "./config.js";
export { SoftureConfigError } from "./config-error.js";
export { withDatabaseOptional } from "./database-requirement.js";
export { moduleManifestSchema, type ModuleManifest } from "./manifest.js";
export {
  defineModule,
  resolveMigrationsDir,
  toModuleJson,
  type AnySoftureModule,
  type HealthCheck,
  type ModuleContext,
  type ModuleFactory,
  type ModuleInput,
  type ModuleMigrations,
  type ModuleSpec,
  type PrivacyContributor,
  type SoftureModule,
} from "./module.js";
export { findSiteUrlProvider, getSiteUrls, type SiteUrlProvider, type SiteUrls } from "./site-urls.js";
export { findSwitchReader, readSwitch, type SwitchReader, type SwitchReading } from "./switches.js";
export { isVersion, parseVersionRange, satisfiesRange, type Version, type VersionRange } from "./version-range.js";
