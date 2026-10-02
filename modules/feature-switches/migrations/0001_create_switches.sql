-- The stored state of the switches an app declares in featureSwitches({ switches }). A switch with
-- no row reads as its declared default; rows of switches no longer declared are ignored, not deleted.
-- Rollback: DROP TABLE features.switches; then
--   DELETE FROM softure.migrations WHERE module = 'feature-switches' AND version = 1;
CREATE TABLE switches (
  name text PRIMARY KEY CHECK (char_length(name) <= 100 AND name ~ '^[a-z][a-z0-9]*(-[a-z0-9]+)*\.[a-z][a-z0-9_]*$'),
  enabled boolean NOT NULL,
  updated_at timestamptz NOT NULL,
  -- The auth user id of whoever set it last; null when an operator set it outside a session.
  -- No foreign key: deleting an account must not change or delete a switch.
  updated_by text CHECK (char_length(updated_by) BETWEEN 1 AND 200)
);
