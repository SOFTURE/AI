import { expect, test } from "@playwright/test";

test("the page lists the ledger and the module migrations applied by softure migrate", async ({ page }) => {
  await page.goto("/");
  const migrations = page.getByTestId("applied-migrations").getByRole("listitem");
  await expect(migrations).toHaveText([
    "analytics 1 create_funnel_counts (applied)",
    // Shipped inside the auth package: a packaged module's migrations apply too.
    "auth 1 create_users_and_sessions (applied)",
    "auth 2 create_user_roles (applied)",
    "auth 3 create_password_resets (applied)",
    "auth 4 index_users_created_at (applied)",
    "billing 1 create_entitlements (applied)",
    "billing 2 create_payments (applied)",
    "billing 3 record_payment_grants (applied)",
    "billing 4 create_requests_and_grants (applied)",
    "billing 5 record_refunded_amounts (applied)",
    "billing 6 record_request_handover_and_prices (applied)",
    "billing 7 record_failed_refunds (applied)",
    "billing 8 record_request_handover_claims (applied)",
    "billing 9 record_pending_charge_states (applied)",
    "blog 1 create_articles (applied)",
    "feature-switches 1 create_switches (applied)",
    "guestbook 1 create_entries (applied)",
    "mailing 1 create_suppressions (applied)",
    "mailing 2 create_campaigns_and_deliveries (applied)",
    "mailing 3 add_delivery_provider_status (applied)",
    "mailing 4 allow_imported_deliveries (applied)",
    "mcp-access 1 create_access_tokens (applied)",
    "mcp-access 2 create_oauth_grants (applied)",
    "privacy 1 create_consents (applied)",
    "security 1 create_rate_limits (applied)",
    "softure 1 ledger (applied)",
    "waitlist 1 create_signups (applied)",
    "waitlist 2 add_confirmation (applied)",
    "waitlist 3 add_channel (applied)",
  ]);
});
