-- Rollback: DROP TABLE linked.links;
-- References an app table, so the app's own migrations must run first (the `before` hook).
CREATE TABLE links (
  id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id integer NOT NULL REFERENCES public.app_users (id)
);
