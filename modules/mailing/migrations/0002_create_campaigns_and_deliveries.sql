-- The delivery ledger: every mail that must go out at most once to a recipient within a scope (a
-- campaign, or a lifecycle event such as `billing.trial-ending:sub_42`). A sender claims the row
-- before calling the provider and closes it with one outcome, `sent` or `rejected`; `pending` is a
-- claim released after the provider was unavailable. Recipients are keys (getRecipientKey), never
-- addresses, as in mailing.suppressions.
-- Rollback: DROP TABLE mailing.deliveries; DROP TABLE mailing.campaigns; then
--   DELETE FROM softure.migrations WHERE module = 'mailing' AND version = 2;

-- A campaign pins its content: a second run with the same id and other content is refused.
CREATE TABLE campaigns (
  id text PRIMARY KEY CHECK (id ~ '^[a-z0-9]+(-[a-z0-9]+)*$' AND length(id) <= 64),
  -- Campaigns are list mail: they carry the unsubscribe link and skip suppressed recipients.
  kind text NOT NULL CHECK (kind ~ '^[a-z0-9]+(-[a-z0-9]+)*$' AND length(kind) <= 64 AND kind <> 'transactional'),
  subject text NOT NULL CHECK (length(subject) BETWEEN 1 AND 998),
  -- sha256 (hex) of the kind, subject, text and HTML bodies.
  content_hash text NOT NULL CHECK (content_hash ~ '^[0-9a-f]{64}$'),
  created_at timestamptz NOT NULL
);

CREATE TABLE deliveries (
  scope text NOT NULL CHECK (scope ~ '^[a-z0-9][a-z0-9._:-]*$' AND length(scope) <= 128),
  recipient_key text NOT NULL CHECK (recipient_key ~ '^[A-Za-z0-9_-]{43}$'),
  kind text NOT NULL CHECK (kind ~ '^[a-z0-9]+(-[a-z0-9]+)*$' AND length(kind) <= 64),
  campaign_id text REFERENCES campaigns (id),
  status text NOT NULL CHECK (status IN ('pending', 'claimed', 'sent', 'rejected')),
  -- Claims so far; an outcome is written only by the holder of the latest claim.
  attempts integer NOT NULL CHECK (attempts >= 1),
  claimed_at timestamptz NOT NULL,
  finished_at timestamptz,
  provider_message_id text,
  -- Why a rejected delivery is final: a mailing.* error code of sendMail.
  reason text CHECK (reason IN ('mailing.invalid_input', 'mailing.rejected', 'mailing.unavailable', 'mailing.suppressed')),
  created_at timestamptz NOT NULL,
  PRIMARY KEY (scope, recipient_key),
  CHECK (campaign_id IS NULL OR scope = 'campaign:' || campaign_id),
  CHECK ((status = 'sent') = (provider_message_id IS NOT NULL)),
  CHECK ((status = 'rejected') = (reason IS NOT NULL)),
  CHECK ((status IN ('sent', 'rejected')) = (finished_at IS NOT NULL))
);

CREATE INDEX deliveries_campaign_status ON deliveries (campaign_id, status) WHERE campaign_id IS NOT NULL;
