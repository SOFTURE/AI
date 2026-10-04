-- Failed refunds: a provider refund that fails after billing acted on it (Stripe `refund.failed`)
-- gives back what it took. Each failure is stored once per refund id, so a repeated delivery gives
-- back nothing twice. A payment keeps the local days refunds took from its period
-- (`taken_back_days`), so a failure can give them back, and the time of the newest charge snapshot
-- it recorded (`refunds_seen_at`, the event's `created`), so a failure of a refund billing never
-- counted gives back nothing and a snapshot taken before a failure is corrected by it.
-- Rollback: DROP TABLE billing.refund_failures;
--   ALTER TABLE billing.payments DROP COLUMN taken_back_days, DROP COLUMN refunds_seen_at; then
--   DELETE FROM softure.migrations WHERE module = 'billing' AND version = 7;
ALTER TABLE payments ADD COLUMN taken_back_days integer NOT NULL DEFAULT 0 CHECK (taken_back_days >= 0);
ALTER TABLE payments ADD COLUMN refunds_seen_at timestamptz;

-- Refunds recorded before this migration were seen when they were recorded (or before now).
UPDATE payments SET refunds_seen_at = COALESCE(refunded_at, now()) WHERE refunded_amount > 0;

CREATE TABLE refund_failures (
  payment_id uuid NOT NULL REFERENCES payments (id) ON DELETE CASCADE,
  -- The provider's refund id (a Stripe Refund, `re_...`).
  refund_id text NOT NULL CHECK (length(refund_id) BETWEEN 1 AND 255),
  -- What the refund was for, in the currency's minor unit.
  amount bigint NOT NULL CHECK (amount >= 0),
  -- When the provider created the refund, and when it reported the failure (the event's time).
  refund_created_at timestamptz NOT NULL,
  failed_at timestamptz NOT NULL,
  recorded_at timestamptz NOT NULL,
  PRIMARY KEY (payment_id, refund_id)
);
