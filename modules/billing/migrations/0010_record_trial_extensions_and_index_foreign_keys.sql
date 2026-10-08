-- Trial extensions an admin makes by hand (extendTrialManually, the admin page's "Extend a trial"
-- form), each with the trial end before and after, so the account's history lists it beside the
-- manual grants. And the indexes behind three foreign keys from auth.users that had none starting
-- with their column, so deleting an account (or an admin's account) does not scan these tables
-- under the delete's lock.
-- Rollback: DROP TABLE billing.trial_extensions; DROP INDEX billing.payment_requests_user_id,
--   billing.manual_grants_granted_by, billing.manual_grants_revoked_by; then
--   DELETE FROM softure.migrations WHERE module = 'billing' AND version = 10;
CREATE TABLE trial_extensions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  -- The admin who extended it; NULL for one without an admin (a script) or once their account is gone.
  extended_by uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  extended_at timestamptz NOT NULL,
  -- The first instant the trial no longer covered before, and after the extension.
  previous_ends_at timestamptz NOT NULL,
  ends_at timestamptz NOT NULL,
  CONSTRAINT trial_extensions_moves_later CHECK (ends_at > previous_ends_at),
  CONSTRAINT trial_extensions_ends_after_extended CHECK (ends_at > extended_at)
);

CREATE INDEX trial_extensions_user_id ON trial_extensions (user_id);
CREATE INDEX trial_extensions_extended_by ON trial_extensions (extended_by) WHERE extended_by IS NOT NULL;

CREATE INDEX payment_requests_user_id ON payment_requests (user_id);
CREATE INDEX manual_grants_granted_by ON manual_grants (granted_by) WHERE granted_by IS NOT NULL;
CREATE INDEX manual_grants_revoked_by ON manual_grants (revoked_by) WHERE revoked_by IS NOT NULL;
