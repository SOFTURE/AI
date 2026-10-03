-- What each provider payment granted, so a full refund takes back only that: a paid period (its
-- start and end) or lifetime access. Rows recorded before this migration keep NULL and a refund of
-- them revokes paid access as before. Lifetime access now keeps the dated end beside it, so a
-- refunded lifetime falls back to the periods bought next to it.
-- Rollback: ALTER TABLE billing.payments DROP CONSTRAINT payments_grant_shape,
--   DROP COLUMN grant_kind, DROP COLUMN granted_from, DROP COLUMN granted_until;
--   UPDATE billing.entitlements SET paid_until = NULL WHERE is_lifetime;
--   ALTER TABLE billing.entitlements ADD CONSTRAINT entitlements_lifetime_without_end
--     CHECK (NOT (is_lifetime AND paid_until IS NOT NULL)); then
--   DELETE FROM softure.migrations WHERE module = 'billing' AND version = 3;
ALTER TABLE entitlements DROP CONSTRAINT entitlements_lifetime_without_end;

ALTER TABLE payments
  -- `period` or `lifetime`; NULL for a payment recorded before grants were stored.
  ADD COLUMN grant_kind text CHECK (grant_kind IN ('period', 'lifetime')),
  -- The paid period the payment added: from where access ended (or the payment's instant) to
  -- the period's end. Both NULL unless `grant_kind` is `period`.
  ADD COLUMN granted_from timestamptz,
  ADD COLUMN granted_until timestamptz,
  ADD CONSTRAINT payments_grant_shape CHECK (
    CASE grant_kind
      WHEN 'period' THEN granted_from IS NOT NULL AND granted_until IS NOT NULL AND granted_until > granted_from
      ELSE granted_from IS NULL AND granted_until IS NULL
    END
  );
