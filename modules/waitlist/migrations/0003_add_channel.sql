-- The acquisition channel of a sign-up (e.g. the analytics channel tag it came with), set at the first
-- sign-up like the placement and never overwritten; NULL when it came without one. 1 to 64 visible
-- ASCII characters: the module stores what the app resolved, it does not know the app's channel rule.
-- Rollback: DROP INDEX waitlist.signups_channel_idx; ALTER TABLE waitlist.signups DROP COLUMN channel; then
--   DELETE FROM softure.migrations WHERE module = 'waitlist' AND version = 3;

ALTER TABLE signups ADD COLUMN channel text CHECK (channel ~ '^[!-~]{1,64}$');

-- Counting sign-ups per channel (countSignupsByChannel) and listing one channel's sign-ups.
CREATE INDEX signups_channel_idx ON signups (channel) WHERE confirmed_at IS NOT NULL;
