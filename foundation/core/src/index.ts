// Public API of @softure-ai/core: the contract every SOFTURE module stands on
// (docs/02-module-standard.md). The Next.js registry is a separate entry: `@softure-ai/core/next`.
export {
  addCalendarDays,
  addCalendarMonths,
  calendarDaysBetween,
  calendarDaySchema,
  getCalendarDay,
  isCalendarDay,
  toCalendarDay,
  wholeMonthsBetween,
  type EndOfMonth,
} from "./calendar-day.js";
export {
  calendarPeriodSchema,
  countPeriodDays,
  doPeriodsOverlap,
  isDayInPeriod,
  type CalendarPeriod,
} from "./calendar-period.js";
export { getLocalDay, isLocalDateTime, localDateTimeSchema, type LocalDateTime } from "./local-date-time.js";
export {
  getDayStartInstant,
  getLocalDateTimeInstant,
  getWallClock,
  getZonedInstant,
  isTimeZone,
  type WallClock,
} from "./zoned-time.js";
export { CURRENCY_MINOR_UNIT_DIGITS } from "./currency-digits.js";
export {
  DEFAULT_DURATION_MESSAGES,
  formatCalendarDay,
  formatCalendarMonth,
  formatDuration,
  formatMoney,
  formatPercent,
  isCalendarMonth,
  type CalendarDayStyle,
  type CalendarMonthStyle,
  type DurationMessages,
  type FormatDurationOptions,
  type FormatMoneyOptions,
  type FormatPercentOptions,
} from "./format.js";
export {
  parseLinkHeader,
  requestJson,
  toQueryString,
  type FetchFunction,
  type HttpJsonAnswer,
  type HttpJsonErrorBodyFailure,
  type HttpJsonFailure,
  type HttpJsonFailureFor,
  type HttpJsonFailureCode,
  type HttpJsonMethod,
  type HttpJsonResponseHeaders,
  type HttpJsonRetryableCode,
  type HttpJsonWriteMethod,
  type LinkHeaderLinks,
  type RequestJsonErrorSchemaOptions,
  type RequestJsonFormWriteOptions,
  type RequestJsonJsonWriteOptions,
  type RequestJsonOptions,
  type RequestJsonReadHeadersOptions,
  type RequestJsonReadOptions,
  type RequestJsonSchemaOptions,
  type RequestJsonWriteOptions,
} from "./http-json.js";
export {
  DEFAULT_MAX_BYTES,
  requestBytes,
  type HttpBytesAnswer,
  type HttpBytesFailure,
  type HttpBytesFailureCode,
  type RequestBytesOptions,
  type RequestBytesReadOptions,
  type RequestBytesWriteOptions,
} from "./http-bytes.js";
export { memoizeByContent, type MemoizeByContentOptions, type MemoizedFunction } from "./memoize.js";
export { createTestClock, systemClock, type Clock, type TestClock } from "./clock.js";
export {
  formatMessage,
  getMessage,
  DEFAULT_LOCALE,
  isLocale,
  mergeMessages,
  pickLocalizedText,
  selectMessages,
  selectPlural,
  type DeepPartial,
  type Dictionaries,
  type Locale,
  type LocalizedText,
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
  type SoftureOrigins,
  type SoftureOriginsInput,
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
export {
  getTrustedOrigins,
  parseOrigin,
  readForwardedProto,
  readRequestHost,
  readRequestOrigin,
  resolveAppOrigin,
  type OriginRequest,
  type ReadOriginOptions,
  type ResolveAppOriginOptions,
} from "./origins.js";
export { findSiteUrlProvider, getSiteUrls, type SiteUrlProvider, type SiteUrls } from "./site-urls.js";
export { findSwitchReader, readSwitch, type SwitchReader, type SwitchReading } from "./switches.js";
export { isVersion, parseVersionRange, satisfiesRange, type Version, type VersionRange } from "./version-range.js";
