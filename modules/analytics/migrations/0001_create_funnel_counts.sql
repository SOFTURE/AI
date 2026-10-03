-- The funnel: one counter per (day, channel, step), nothing else. No address, cookie, visit id or
-- account is stored, only how many visits reached a step from a channel on a day.
-- Rollback: DROP TABLE analytics.funnel_counts; then
--   DELETE FROM softure.migrations WHERE module = 'analytics' AND version = 1;

CREATE TABLE funnel_counts (
  -- The calendar day in the app's time zone (config.timezone), computed by the database.
  day date NOT NULL,
  -- The channel tag; '' for visits without one, '~overflow' for new tags past the daily cap.
  -- Tags are validated by the app's pattern, so only their size is checked here.
  channel text NOT NULL CHECK (char_length(channel) <= 64),
  -- A step id from analytics({ funnel: { steps } }).
  step text NOT NULL CHECK (char_length(step) <= 32 AND step ~ '^[a-z][a-z0-9]*(-[a-z0-9]+)*$'),
  count bigint NOT NULL CHECK (count > 0),
  CONSTRAINT funnel_counts_pkey PRIMARY KEY (day, channel, step)
);

-- "Was this channel counted before?" (the daily cap spares known channels).
CREATE INDEX funnel_counts_channel_idx ON funnel_counts (channel, day);
