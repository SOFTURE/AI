-- Pending charge states: Stripe does not order events, so a new refund's `charge.refunded` can arrive
-- before the failure of an earlier refund of the same charge. Its `amount_refunded` then reports no
-- more than billing counts, and applying it would undo nothing billing knows of. A payment keeps the
-- newest such state it did not apply (the raw total and the event's `created`), so the failure that
-- explains it applies it after giving back the failed refund: the new refund is taken back once.
-- Applying a state at or after the kept one's time clears it.
-- Rollback: ALTER TABLE billing.payments DROP CONSTRAINT payments_pending_charge_state_shape;
--   ALTER TABLE billing.payments DROP COLUMN pending_refunded_amount, DROP COLUMN pending_refunds_seen_at; then
--   DELETE FROM softure.migrations WHERE module = 'billing' AND version = 9;
ALTER TABLE payments ADD COLUMN pending_refunded_amount bigint;
ALTER TABLE payments ADD COLUMN pending_refunds_seen_at timestamptz;

ALTER TABLE payments ADD CONSTRAINT payments_pending_charge_state_shape CHECK (
  (pending_refunded_amount IS NULL AND pending_refunds_seen_at IS NULL)
  OR (pending_refunded_amount IS NOT NULL AND pending_refunded_amount >= 0 AND pending_refunds_seen_at IS NOT NULL)
);
