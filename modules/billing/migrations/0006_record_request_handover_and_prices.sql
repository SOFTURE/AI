-- Invoice requests are stored before the provider hands them to the owner, and the owner hears of
-- an open request once: handed_over_at is set by a conditional update that claims the hand-over
-- and cleared again when it fails, so the next ask retries. Requests and manual grants record the
-- plan's price (what was quoted, what was granted). Open requests nobody asks again for expire
-- (status 'expired', details cleared like any closed request). Invoice details refuse control
-- characters, so a name cannot add lines to the owner's mail; the CHECKs are NOT VALID, so older
-- rows are not rewritten, while every insert and update is checked.
-- Rollback: UPDATE billing.payment_requests SET status = 'dismissed' WHERE status = 'expired';
--   ALTER TABLE billing.payment_requests DROP CONSTRAINT payment_requests_status_check, then
--   ADD CONSTRAINT payment_requests_status_check CHECK (status IN ('open', 'granted', 'dismissed'));
--   ALTER TABLE billing.payment_requests DROP CONSTRAINT payment_requests_invoice_name_printable,
--   DROP CONSTRAINT payment_requests_invoice_tax_id_printable, DROP CONSTRAINT payment_requests_invoice_address_printable,
--   DROP CONSTRAINT payment_requests_price_pair, DROP COLUMN handed_over_at, DROP COLUMN amount, DROP COLUMN currency;
--   ALTER TABLE billing.manual_grants DROP CONSTRAINT manual_grants_price_pair, DROP COLUMN amount, DROP COLUMN currency;
--   then DELETE FROM softure.migrations WHERE module = 'billing' AND version = 6;
ALTER TABLE payment_requests ADD COLUMN handed_over_at timestamptz;

-- Every open request stored before this migration was stored after its hand-over succeeded.
UPDATE payment_requests SET handed_over_at = requested_at WHERE status = 'open';

-- The plan's price when the request was asked for or last refreshed, in the currency's minor
-- unit; NULL on rows stored before this migration (the config is not in a migration's reach).
ALTER TABLE payment_requests ADD COLUMN amount bigint CHECK (amount >= 0);
ALTER TABLE payment_requests ADD COLUMN currency text CHECK (currency ~ '^[A-Z]{3}$');
ALTER TABLE payment_requests ADD CONSTRAINT payment_requests_price_pair CHECK ((amount IS NULL) = (currency IS NULL));

-- What the grant was for: the price its request quoted, else the plan's price when granted.
ALTER TABLE manual_grants ADD COLUMN amount bigint CHECK (amount >= 0);
ALTER TABLE manual_grants ADD COLUMN currency text CHECK (currency ~ '^[A-Z]{3}$');
ALTER TABLE manual_grants ADD CONSTRAINT manual_grants_price_pair CHECK ((amount IS NULL) = (currency IS NULL));

ALTER TABLE payment_requests DROP CONSTRAINT payment_requests_status_check;
ALTER TABLE payment_requests ADD CONSTRAINT payment_requests_status_check CHECK (status IN ('open', 'granted', 'dismissed', 'expired'));

-- C0 controls, DEL and C1 controls (Unicode Cc); NUL cannot be stored in text at all.
ALTER TABLE payment_requests ADD CONSTRAINT payment_requests_invoice_name_printable CHECK (invoice_name !~ '[\x01-\x1f\x7f-\x9f]') NOT VALID;
ALTER TABLE payment_requests ADD CONSTRAINT payment_requests_invoice_tax_id_printable CHECK (invoice_tax_id !~ '[\x01-\x1f\x7f-\x9f]') NOT VALID;
ALTER TABLE payment_requests ADD CONSTRAINT payment_requests_invoice_address_printable CHECK (invoice_address !~ '[\x01-\x1f\x7f-\x9f]') NOT VALID;
