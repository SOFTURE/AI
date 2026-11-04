-- Budget limits an operator changed at runtime: a row overrides the `limit` of the budget declared in
-- `metering({ providers })` with the same provider, period and scope; without a row the configured limit applies.
-- A stored limit may be 0 (the provider is stopped). `updated_by` is the app's account id of whoever changed it.
-- Rollback: DROP TABLE metering.budget_limits; then
--   DELETE FROM softure.migrations WHERE module = 'metering' AND version = 3;
CREATE TABLE budget_limits (
  provider text NOT NULL CHECK (char_length(provider) <= 64 AND provider ~ '^[a-z][a-z0-9]*([._-][a-z0-9]+)*$'),
  period text NOT NULL CHECK (period IN ('day', 'month')),
  per_account boolean NOT NULL,
  "limit" numeric(24, 8) NOT NULL CHECK ("limit" >= 0),
  updated_at timestamptz NOT NULL,
  updated_by text CHECK (char_length(updated_by) BETWEEN 1 AND 200),
  PRIMARY KEY (provider, period, per_account)
);

CREATE INDEX budget_limits_updated_by_idx ON budget_limits (updated_by) WHERE updated_by IS NOT NULL;
