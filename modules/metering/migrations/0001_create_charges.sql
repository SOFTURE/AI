-- The ledger of paid provider calls: a `reserved` row holds budget while a call runs and expires at `expires_at`;
-- a `settled` row is what the provider billed. Amounts are in the provider's unit and never negative.
-- Rollback: DROP TABLE metering.charges; then
--   DELETE FROM softure.migrations WHERE module = 'metering' AND version = 1;
CREATE TABLE charges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider text NOT NULL CHECK (char_length(provider) <= 64 AND provider ~ '^[a-z][a-z0-9]*([._-][a-z0-9]+)*$'),
  -- What the call was for (a pipeline step, a model); null when the app names none.
  step text CHECK (char_length(step) BETWEEN 1 AND 100),
  unit text NOT NULL CHECK (unit IN ('credits', 'usd', 'characters', 'seconds', 'tokens', 'requests')),
  amount numeric(24, 8) NOT NULL CHECK (amount >= 0),
  -- The app's account (or user) id the spend belongs to; null for spend of the app itself.
  account_id text CHECK (char_length(account_id) BETWEEN 1 AND 200),
  -- The app's own string attributes, e.g. a job id.
  attributes jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(attributes) = 'object'),
  status text NOT NULL CHECK (status IN ('reserved', 'settled')),
  -- When the spend was reserved or recorded: the period it counts in.
  created_at timestamptz NOT NULL,
  expires_at timestamptz,
  settled_at timestamptz,
  CHECK ((status = 'reserved') = (expires_at IS NOT NULL)),
  CHECK ((status = 'settled') = (settled_at IS NOT NULL))
);

CREATE INDEX charges_provider_created_at_idx ON charges (provider, created_at);
CREATE INDEX charges_account_id_idx ON charges (account_id) WHERE account_id IS NOT NULL;
CREATE INDEX charges_expires_at_idx ON charges (expires_at) WHERE status = 'reserved';
