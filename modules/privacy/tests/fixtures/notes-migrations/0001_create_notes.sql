-- A test module's table that references auth.users without a cascade, so deleting the account
-- before the notes fails: privacy must delete the notes first.
-- Rollback: DROP TABLE notes.notes; then
--   DELETE FROM softure.migrations WHERE module = 'notes' AND version = 1;
CREATE TABLE notes (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE RESTRICT,
  body text NOT NULL
);
