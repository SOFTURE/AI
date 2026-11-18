-- Connections a user makes for themselves (a provider with owner: "user"): `owner_id` names the auth user a connection
-- and an authorization in flight belong to, null for the app's own connection. A provider account is unique per owner:
-- the app's (provider, account_id) as before, and each user's own. `subject` keeps the provider's id of the connected
-- account (the token response's `subjectField`, such as Dropbox's account_id). No foreign key to auth.users: the
-- privacy contributor deletes a user's connections with their account, and a connection never outlives that.
-- Rollback: DROP INDEX connections.accounts_owner_key; DROP INDEX connections.accounts_app_key;
--   DELETE FROM connections.accounts WHERE owner_id IS NOT NULL;
--   ALTER TABLE connections.accounts ADD CONSTRAINT accounts_provider_account_key UNIQUE (provider, account_id);
--   ALTER TABLE connections.accounts DROP COLUMN subject; ALTER TABLE connections.accounts DROP COLUMN owner_id;
--   ALTER TABLE connections.oauth_states DROP COLUMN owner_id;
--   DELETE FROM softure.migrations WHERE module = 'connections' AND version = 3;

ALTER TABLE accounts ADD COLUMN owner_id text CHECK (char_length(owner_id) BETWEEN 1 AND 200);
ALTER TABLE accounts ADD COLUMN subject text CHECK (subject ~ '^[\x21-\x7e]{1,200}$');
ALTER TABLE accounts DROP CONSTRAINT accounts_provider_account_key;
CREATE UNIQUE INDEX accounts_app_key ON accounts (provider, account_id) WHERE owner_id IS NULL;
CREATE UNIQUE INDEX accounts_owner_key ON accounts (owner_id, provider, account_id) WHERE owner_id IS NOT NULL;

-- The user a pending authorization connects for; null when it connects the app's own account.
ALTER TABLE oauth_states ADD COLUMN owner_id text CHECK (char_length(owner_id) BETWEEN 1 AND 200);
ALTER TABLE oauth_states ADD CONSTRAINT oauth_states_owner_check CHECK (owner_id IS NULL OR owner_id = created_by);
