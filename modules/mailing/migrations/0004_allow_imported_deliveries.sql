-- Lets an app seed the ledger with the deliveries it made before it adopted the module (importDeliveries), so the
-- first deliverOnce or campaign run skips them. Its history rarely kept the provider's message id, so a `sent` row
-- needs one only when the module sent it; an imported row is marked by imported_at. A row the module did not close
-- still never has a message id.
-- Rollback: DELETE FROM mailing.deliveries WHERE imported_at IS NOT NULL AND provider_message_id IS NULL;
--   ALTER TABLE mailing.deliveries DROP CONSTRAINT deliveries_message_id_check;
--   ALTER TABLE mailing.deliveries DROP CONSTRAINT deliveries_sent_message_id_check;
--   ALTER TABLE mailing.deliveries DROP COLUMN imported_at;
--   ALTER TABLE mailing.deliveries ADD CONSTRAINT deliveries_check1 CHECK ((status = 'sent') = (provider_message_id IS NOT NULL));
--   DELETE FROM softure.migrations WHERE module = 'mailing' AND version = 4;

-- When the row was imported; null for a delivery the module made. Only a closed row can be imported.
ALTER TABLE deliveries ADD COLUMN imported_at timestamptz
  CONSTRAINT deliveries_imported_at_check CHECK (imported_at IS NULL OR status IN ('sent', 'rejected'));

-- Was: CHECK ((status = 'sent') = (provider_message_id IS NOT NULL)), unnamed in 0002.
ALTER TABLE deliveries DROP CONSTRAINT deliveries_check1;
ALTER TABLE deliveries ADD CONSTRAINT deliveries_message_id_check CHECK (provider_message_id IS NULL OR status = 'sent');
ALTER TABLE deliveries ADD CONSTRAINT deliveries_sent_message_id_check
  CHECK (status <> 'sent' OR provider_message_id IS NOT NULL OR imported_at IS NOT NULL);
