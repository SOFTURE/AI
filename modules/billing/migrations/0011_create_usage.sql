-- The usage ledger behind consumeUsage: how much of each meter an account used in each period (a
-- calendar month in the app's time zone, starting at period_start). One row per account, meter and
-- period; consumeUsage adds to it with a conditional upsert, so the count never passes the limit.
-- Rollback: DROP TABLE billing.usage; then
--   DELETE FROM softure.migrations WHERE module = 'billing' AND version = 11;
CREATE TABLE usage (
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  meter text NOT NULL CHECK (meter ~ '^[a-z][a-z0-9]*(-[a-z0-9]+)*$' AND length(meter) <= 64),
  period text NOT NULL CHECK (period IN ('month')),
  -- The first instant of the period.
  period_start timestamptz NOT NULL,
  used bigint NOT NULL CHECK (used >= 0),
  updated_at timestamptz NOT NULL,
  PRIMARY KEY (user_id, meter, period, period_start)
);
