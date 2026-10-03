-- Entitlements: at most one row per account, apart from auth.users. An account without a row is on
-- the trial that starts at its auth.users.created_at (computed by the module, never stored), so a
-- row exists only once something changed: a grant, a revoke or a trial extension.
-- Rollback: DROP TABLE billing.entitlements; then
--   DELETE FROM softure.migrations WHERE module = 'billing' AND version = 1;
CREATE TABLE entitlements (
  user_id uuid PRIMARY KEY REFERENCES auth.users (id) ON DELETE CASCADE,
  trial_ends_at timestamptz NOT NULL,
  -- NULL: never paid, or revoked. Lifetime access has no end, so it is a flag, not a date.
  paid_until timestamptz,
  is_lifetime boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL,
  CONSTRAINT entitlements_lifetime_without_end CHECK (NOT (is_lifetime AND paid_until IS NOT NULL)),
  CONSTRAINT entitlements_updated_after_created CHECK (updated_at >= created_at)
);
