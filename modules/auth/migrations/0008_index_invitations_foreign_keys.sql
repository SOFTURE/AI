-- The foreign keys of auth.invitations get an index each: deleting an account sets invited_by and
-- accepted_user_id to null, and without an index Postgres scans the table for every deleted account.
-- Rollback: DROP INDEX auth.invitations_invited_by_idx, auth.invitations_accepted_user_id_idx; then
--   DELETE FROM softure.migrations WHERE module = 'auth' AND version = 8;
CREATE INDEX invitations_invited_by_idx ON invitations (invited_by);
CREATE INDEX invitations_accepted_user_id_idx ON invitations (accepted_user_id);
