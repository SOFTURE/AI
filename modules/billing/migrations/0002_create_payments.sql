-- Payments taken by a provider (Stripe Checkout): one row per paid checkout, written in the same
-- transaction as the plan grant it caused, so a webhook delivered twice (or two events for one
-- checkout) grants once. A full refund flips the row to `refunded` with a conditional update, so
-- the paid access it gave is revoked once.
-- Rollback: DROP TABLE billing.payments; then
--   DELETE FROM softure.migrations WHERE module = 'billing' AND version = 2;
CREATE TABLE payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  -- The adapter's name, e.g. `stripe`.
  provider text NOT NULL CHECK (provider ~ '^[a-z][a-z0-9-]*$' AND length(provider) <= 32),
  -- The provider's checkout id (a Stripe Checkout Session, `cs_...`).
  checkout_id text NOT NULL CHECK (length(checkout_id) BETWEEN 1 AND 255),
  -- The provider's payment id that refunds name (a Stripe PaymentIntent, `pi_...`); NULL when the
  -- provider gave none (a free checkout).
  payment_id text CHECK (length(payment_id) BETWEEN 1 AND 255),
  plan_id text NOT NULL CHECK (length(plan_id) BETWEEN 1 AND 64),
  -- What the provider charged, in the currency's minor unit.
  amount bigint NOT NULL CHECK (amount >= 0),
  currency text NOT NULL CHECK (currency ~ '^[A-Z]{3}$'),
  status text NOT NULL CHECK (status IN ('paid', 'refunded')),
  paid_at timestamptz NOT NULL,
  refunded_at timestamptz,
  CONSTRAINT payments_checkout_once UNIQUE (provider, checkout_id),
  CONSTRAINT payments_payment_once UNIQUE (provider, payment_id),
  CONSTRAINT payments_refunded_at_with_status CHECK ((status = 'refunded') = (refunded_at IS NOT NULL)),
  CONSTRAINT payments_refunded_after_paid CHECK (refunded_at IS NULL OR refunded_at >= paid_at)
);

CREATE INDEX payments_user_id ON payments (user_id);
