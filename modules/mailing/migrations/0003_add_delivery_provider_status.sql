-- Keeps the provider's HTTP status with a delivery (the last failed answer, also on a released claim), and lets a
-- released claim give its attempt back: a halt (refused key, spent quota) says nothing about the mail, so a
-- `pending` row may hold 0 attempts until it is claimed again.
-- Rollback: ALTER TABLE mailing.deliveries DROP COLUMN provider_status;
--   UPDATE mailing.deliveries SET attempts = 1 WHERE attempts = 0;
--   ALTER TABLE mailing.deliveries DROP CONSTRAINT deliveries_attempts_check;
--   ALTER TABLE mailing.deliveries ADD CONSTRAINT deliveries_attempts_check CHECK (attempts >= 1);
--   DELETE FROM softure.migrations WHERE module = 'mailing' AND version = 3;

ALTER TABLE deliveries ADD COLUMN provider_status integer CHECK (provider_status BETWEEN 100 AND 599);

ALTER TABLE deliveries DROP CONSTRAINT deliveries_attempts_check;
ALTER TABLE deliveries ADD CONSTRAINT deliveries_attempts_check CHECK (attempts >= 1 OR (attempts = 0 AND status = 'pending'));
