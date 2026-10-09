// Playwright helpers of @softure-ai/testing (`@softure-ai/testing/playwright`): black-box tests of a
// SOFTURE app. Needs `@playwright/test` (an optional peer dependency).
export { expectFieldAbsent, expectFieldPresent, expectPageStatus } from "./assertions.js";
export { logIn, registerAccount, submitLogin, type AuthFormCopy, type AuthFormInput, type AuthNavigationOptions } from "./auth.js";
export { tickCheckbox, type TickCheckboxOptions } from "./checkbox.js";
export { CLIENT_ADDRESS_HEADER, clientAddressHeaders, openPageAsNewClient, randomClientAddress } from "./client-address.js";
export { hostResolverRules, softurePlaywrightUse, type SofturePlaywrightOptions, type SofturePlaywrightUse } from "./preset.js";
export { followLink, readHref, type FollowLinkOptions } from "./links.js";
export { chooseOption, listRow, readSelectedValue, selectField } from "./select.js";
export { uniqueEmail, uniqueName, withDatabase, type Closable } from "./test-data.js";
export { waitFor, type WaitForOptions } from "./wait-for.js";
export { expect, test, type ClientAddressFixtures } from "./test.js";
