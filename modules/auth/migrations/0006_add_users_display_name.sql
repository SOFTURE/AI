-- The name an OpenID Connect provider sends (`name`, else `given_name`), refreshed at every sign-in that carries one;
-- null for a password account and for a provider that sends none. Normalized by the module: trimmed, at most 200
-- characters. A nullable column without a default, so adding it rewrites no row.
-- Rollback: ALTER TABLE auth.users DROP COLUMN display_name; then
--   DELETE FROM softure.migrations WHERE module = 'auth' AND version = 6;
ALTER TABLE users
  ADD COLUMN display_name text
  CONSTRAINT users_display_name_check CHECK (display_name = btrim(display_name) AND char_length(display_name) BETWEEN 1 AND 200);
