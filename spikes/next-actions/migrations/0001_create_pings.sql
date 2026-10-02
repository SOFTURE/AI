-- Proves that a module installed from a package ships its migrations and that the app builds with
-- them declared (context/backlog/next-integration.md). Rollback: DROP TABLE next_actions.pings.
CREATE TABLE next_actions.pings (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  created_at timestamptz NOT NULL DEFAULT now()
);
