-- Partial refunds: how much of each provider payment was refunded so far, in the currency's minor
-- unit, as the provider reports it (Stripe's cumulative `amount_refunded`). A delivery whose amount
-- is not above the stored one changes nothing, so repeated and stale deliveries are harmless. A
-- payment stays `paid` while part of it is refunded and turns `refunded` when all of it is.
-- Rollback: ALTER TABLE billing.payments DROP CONSTRAINT payments_refunded_amount_by_status;
--   ALTER TABLE billing.payments DROP COLUMN refunded_amount; then
--   DELETE FROM softure.migrations WHERE module = 'billing' AND version = 5;
ALTER TABLE payments ADD COLUMN refunded_amount bigint NOT NULL DEFAULT 0;

-- Payments refunded before this migration were refunded in full.
UPDATE payments SET refunded_amount = amount WHERE status = 'refunded';

ALTER TABLE payments ADD CONSTRAINT payments_refunded_amount_by_status CHECK (
  CASE status
    WHEN 'refunded' THEN refunded_amount = amount
    ELSE refunded_amount >= 0 AND (refunded_amount < amount OR amount = 0)
  END
);
