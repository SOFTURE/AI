-- Manual payments in the admin page: the invoice requests buyers send (listed until the admin
-- grants or dismisses them) and the plans the admin grants by hand, each with what it added, so a
-- mistaken grant is revoked by taking back only that. Provider payments stay in billing.payments.
-- Invoice details are personal data kept only while a request is open: the closing update clears
-- them (payment_requests_details_while_open).
-- Rollback: DROP TABLE billing.manual_grants; DROP TABLE billing.payment_requests; then
--   DELETE FROM softure.migrations WHERE module = 'billing' AND version = 4;
CREATE TABLE payment_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  plan_id text NOT NULL CHECK (length(plan_id) BETWEEN 1 AND 64),
  -- The invoice details as the buyer typed them (trimmed); NULL once the request is closed, or
  -- when the provider collects its own.
  invoice_name text CHECK (length(invoice_name) BETWEEN 1 AND 200),
  invoice_tax_id text CHECK (length(invoice_tax_id) BETWEEN 1 AND 32),
  invoice_address text CHECK (length(invoice_address) BETWEEN 1 AND 500),
  status text NOT NULL CHECK (status IN ('open', 'granted', 'dismissed')),
  requested_at timestamptz NOT NULL,
  closed_at timestamptz,
  CONSTRAINT payment_requests_closed_at_with_status CHECK ((status = 'open') = (closed_at IS NULL)),
  CONSTRAINT payment_requests_closed_after_requested CHECK (closed_at IS NULL OR closed_at >= requested_at),
  CONSTRAINT payment_requests_name_with_address CHECK ((invoice_name IS NULL) = (invoice_address IS NULL)),
  CONSTRAINT payment_requests_tax_id_with_name CHECK (invoice_tax_id IS NULL OR invoice_name IS NOT NULL),
  CONSTRAINT payment_requests_details_while_open CHECK (status = 'open' OR invoice_name IS NULL)
);

-- One open request per account and plan: asking again refreshes it instead of adding a row.
CREATE UNIQUE INDEX payment_requests_one_open ON payment_requests (user_id, plan_id) WHERE status = 'open';
CREATE INDEX payment_requests_open_by_age ON payment_requests (requested_at) WHERE status = 'open';

CREATE TABLE manual_grants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  plan_id text NOT NULL CHECK (length(plan_id) BETWEEN 1 AND 64),
  -- The request the grant answered; NULL for a grant typed in by email.
  request_id uuid UNIQUE REFERENCES payment_requests (id) ON DELETE SET NULL,
  -- The admins who granted and revoked it; NULL once their account is gone.
  granted_by uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  granted_at timestamptz NOT NULL,
  -- What the grant added, as billing.payments records it (0003).
  grant_kind text NOT NULL CHECK (grant_kind IN ('period', 'lifetime')),
  granted_from timestamptz,
  granted_until timestamptz,
  status text NOT NULL CHECK (status IN ('active', 'revoked')),
  revoked_at timestamptz,
  revoked_by uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  CONSTRAINT manual_grants_grant_shape CHECK (
    CASE grant_kind
      WHEN 'period' THEN granted_from IS NOT NULL AND granted_until IS NOT NULL AND granted_until > granted_from
      ELSE granted_from IS NULL AND granted_until IS NULL
    END
  ),
  CONSTRAINT manual_grants_revoked_at_with_status CHECK ((status = 'revoked') = (revoked_at IS NOT NULL)),
  CONSTRAINT manual_grants_revoked_by_when_revoked CHECK (revoked_by IS NULL OR status = 'revoked'),
  CONSTRAINT manual_grants_revoked_after_granted CHECK (revoked_at IS NULL OR revoked_at >= granted_at)
);

CREATE INDEX manual_grants_user_id ON manual_grants (user_id);
