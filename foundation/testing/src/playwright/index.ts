// Playwright helpers of @softure-ai/testing (`@softure-ai/testing/playwright`): black-box tests of a
// SOFTURE app. Needs `@playwright/test` (an optional peer dependency).
export { createTestDatabaseClient, type RowFilterValue, type TestDatabaseClient, type TestDatabaseClientOptions } from "./database-client.js";
export { expectFieldAbsent, expectFieldPresent, expectPageStatus } from "./assertions.js";
export {
  logIn,
  registerAccount,
  signInPerFile,
  submitLogin,
  type AuthFormCopy,
  type AuthFormInput,
  type AuthNavigationOptions,
  type PerFileAccount,
  type SignInPerFileOptions,
} from "./auth.js";
export { tickCheckbox, type TickCheckboxOptions } from "./checkbox.js";
export { CLIENT_ADDRESS_HEADER, clientAddressHeaders, openPageAsNewClient, randomClientAddress } from "./client-address.js";
export { hostResolverRules, softurePlaywrightUse, type SofturePlaywrightOptions, type SofturePlaywrightUse } from "./preset.js";
export { followLink, readHref, type FollowLinkOptions } from "./links.js";
export { chooseOption, listRow, readSelectedValue, selectField } from "./select.js";
export { uniqueEmail, uniqueName, withDatabase, type Closable } from "./test-data.js";
export { waitFor, type WaitForOptions } from "./wait-for.js";
export { emulateInstalledApp } from "./installed-app.js";
export {
  emulateSafeAreaInsets,
  expectClearOfSafeAreaInsets,
  IPHONE_SAFE_AREA,
  type ColorScheme,
  type ExpectClearOfSafeAreaInsetsOptions,
  type SafeAreaInsets,
} from "./safe-area.js";
export {
  expectLoadWithin,
  PHONE_CPU_SLOWDOWN,
  PHONE_NETWORK_PROFILES,
  throttleLikePhone,
  type ExpectLoadWithinOptions,
  type NetworkProfile,
  type PhoneNetworkName,
  type PhoneThrottle,
  type ThrottleLikePhoneOptions,
} from "./phone.js";
export { expectWorksOffline, type ExpectWorksOfflineOptions } from "./offline.js";
export { expectTouchTargets, TAPPABLE_SELECTOR, TOUCH_TARGET_PX, type ExpectTouchTargetsOptions } from "./touch-targets.js";
export { expect, test, type ClientAddressFixtures } from "./test.js";
