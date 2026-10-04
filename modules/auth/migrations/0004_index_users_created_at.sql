-- Accounts by creation time: billing finds the accounts whose derived trial is in a reminder
-- window with a range on created_at, without scanning every account.
-- Rollback: DROP INDEX auth.users_created_at_idx; then
--   DELETE FROM softure.migrations WHERE module = 'auth' AND version = 4;
CREATE INDEX users_created_at_idx ON users (created_at);
